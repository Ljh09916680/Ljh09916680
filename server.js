const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const nameGenerator = require('./nameGenerator');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/api/name', nameGenerator);


// DeepSeek R1 API配置
const API_KEY = 'b40891f4-6885-413c-96be-baac77afa115';
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

// 处理聊天请求
// 保存对话到Word文档
async function saveToWord(messages) {
    const doc = new Document({
        sections: [{
            properties: {},
            children: messages.map(msg => {
                return new Paragraph({
                    children: [
                        new TextRun({
                            text: `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`,
                            size: 24
                        })
                    ]
                })
            })
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    const fs = require('fs');
    const fileName = `对话记录_${new Date().toISOString().replace(/[:.]/g, '-')}.docx`;
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, buffer);
    return fileName;
}

// 存储对话历史
let chatHistory = [];

app.post('/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        
        // 添加用户消息到历史记录
        chatHistory.push({ role: 'user', content: userMessage });

        // 设置响应头，启用流式输出
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // 准备请求体
        const requestBody = {
            model: 'deepseek-r1-250120',
            messages: [
                {
                    role: 'system',
                    content: '你是一位专业的Life Coach，擅长通过对话帮助人们进行个人成长。你会以友善、专业的态度倾听用户的问题，给出有建设性的建议和指导。你的回答应该具有洞察力，能够帮助用户发现自己的潜力和解决方案。'
                },
                {
                    role: 'user',
                    content: userMessage
                }
            ],
            stream: true,
            temperature: 0.6
        };

        // 发送请求到DeepSeek R1 API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('API错误响应:', errorData);
            res.status(response.status).send(`API请求失败: ${response.status} - ${errorData}`);
            return;
        }

        // 处理流式响应
        let buffer = '';
        response.body.on('data', chunk => {
            const text = chunk.toString();
            buffer += text;

            // 处理完整的数据行
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

                try {
                    if (trimmedLine.startsWith('data: ')) {
                        const jsonStr = trimmedLine.substring(6);
                        const jsonData = JSON.parse(jsonStr);
                        if (jsonData.choices && jsonData.choices[0].delta && jsonData.choices[0].delta.content) {
                            const content = jsonData.choices[0].delta.content;
                            res.write(content);
                            
                            // 累积AI响应
                            if (!currentAIResponse) currentAIResponse = '';
                            currentAIResponse += content;
                        }
                    }
                } catch (parseError) {
                    console.error('解析数据出错:', parseError, '原始数据:', trimmedLine);
                    continue;
                }
            }
        });

        let currentAIResponse = '';

        response.body.on('end', async () => {
            // 处理最后的缓冲区
            if (buffer.trim()) {
                try {
                    const lines = buffer.split('\n');
                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

                        const jsonStr = trimmedLine.replace(/^data: /, '');
                        const jsonData = JSON.parse(jsonStr);
                        if (jsonData.choices && jsonData.choices[0].delta && jsonData.choices[0].delta.content) {
                            const content = jsonData.choices[0].delta.content;
                            res.write(content);
                            
                            // 累积AI响应
                            if (!currentAIResponse) currentAIResponse = '';
                            currentAIResponse += content;
                        }
                    }
                } catch (parseError) {
                    console.error('解析最后的数据出错:', parseError);
                }
            }
            // 添加AI响应到历史记录
            if (currentAIResponse) {
                chatHistory.push({ role: 'assistant', content: currentAIResponse });
                
                // 导出对话到Word文档
                try {
                    const fileName = await saveToWord(chatHistory);
                    console.log(`对话已保存到: ${fileName}`);
                } catch (error) {
                    console.error('保存对话到Word文档时出错:', error);
                }
            }
            
            res.end();
        });

        response.body.on('error', async error => {
            console.error('处理流数据时出错:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: '处理响应流时发生错误' });
            } else {
                // 添加AI响应到历史记录
            if (currentAIResponse) {
                chatHistory.push({ role: 'assistant', content: currentAIResponse });
                
                // 导出对话到Word文档
                try {
                    const fileName = await saveToWord(chatHistory);
                    console.log(`对话已保存到: ${fileName}`);
                } catch (error) {
                    console.error('保存对话到Word文档时出错:', error);
                }
            }
            
            res.end();
            }
        });



    } catch (error) {
        console.error('服务器错误:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || '服务器内部错误' });
        }
    }
});

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});