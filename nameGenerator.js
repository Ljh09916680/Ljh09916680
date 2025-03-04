const express = require('express');
const router = express.Router();

// 中文名字生成逻辑
function generateChineseName(englishName) {
    // 简单的音译映射表
    const nameMap = {
        'a': '阿',
        'b': '贝',
        'c': '茨',
        'd': '德',
        'e': '厄',
        'f': '弗',
        'g': '格',
        'h': '赫',
        'i': '伊',
        'j': '杰',
        'k': '凯',
        'l': '勒',
        'm': '姆',
        'n': '恩',
        'o': '奥',
        'p': '帕',
        'q': '奇',
        'r': '尔',
        's': '斯',
        't': '特',
        'u': '乌',
        'v': '维',
        'w': '维',
        'x': '克斯',
        'y': '伊',
        'z': '兹'
    };

    // 将英文名转换为小写并分割成字符
    const chars = englishName.toLowerCase().split('');
    
    // 转换每个字符
    let chineseName = '';
    chars.forEach((char, index) => {
        if (nameMap[char]) {
            chineseName += nameMap[char];
        }
    });

    return chineseName;
}

// 处理名字生成请求
router.post('/generate', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: '请提供英文名字' });
        }

        const chineseName = generateChineseName(name);
        res.json({ chineseName });
    } catch (error) {
        console.error('生成名字时出错:', error);
        res.status(500).json({ error: '生成名字时出现错误' });
    }
});

module.exports = router;