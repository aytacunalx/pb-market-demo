const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Resim klasörünü dışarı aç
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// --- VERİTABANI ---
let users = [
    { 
        id: 1, username: "OTTEO", password: "123", role: "user",
        tg: 115000, rank: "Tuğgeneral", rankLevel: 46, // assets/ranks/46.png
        exp: "11,101,630", expPercent: 82,
        stats: { playTime: "132,356dk", battleTime: "73,353dk", kd: "64%" },
        inventory: [
            { uid: 101, name: "AUG A3 E-Sport", type: "assault_rifle", days: 7, img: "aug.png" },
            { uid: 102, name: "Kriss S.V. PBIC", type: "smg", days: 30, img: "kriss.png" },
            { uid: 103, name: "Fang Blade", type: "melee_weapon", days: 3, img: "fangblade.png" }
        ]
    },
    { 
        id: 2, username: "BuyerDude", password: "123", role: "user",
        tg: 500000, rank: "Binbaşı", rankLevel: 26, 
        exp: "5,000,000", expPercent: 45,
        stats: { playTime: "40k", battleTime: "20k", kd: "50%" }, inventory: [] 
    },
    {
        id: 0, username: "GameMaster", password: "admin", role: "admin",
        tg: 999999999, rank: "ADMIN", rankLevel: 50, exp: "MAX", expPercent: 100,
        stats: { playTime: "∞", battleTime: "∞", kd: "100%" }, inventory: []
    }
];

let marketListings = [
    { id: 1, sellerId: 99, itemName: "Cheytac M200", type: "sniper", price: 5000, days: 7, status: 'SALE', img: "cheytac.png" },
    { id: 2, sellerId: 99, itemName: "M1887", type: "shotgun", price: 2500, days: 3, status: 'SALE', img: "m1887.png" },
    { id: 3, sellerId: 99, itemName: "Chou", type: "character", price: 8000, days: 30, status: 'SALE', img: "chou.png" },
    { id: 4, sellerId: 99, itemName: "Altın Maske", type: "head", price: 4500, days: 7, status: 'SALE', img: "mask.png" },
    { id: 5, sellerId: 99, itemName: "Combat Machete", type: "melee_weapon", price: 1500, days: 90, status: 'SALE', img: "machete.png" },
    { id: 6, sellerId: 99, itemName: "K-400 Fire", type: "throwing_weapon_1", price: 600, days: 3, status: 'SALE', img: "k400.png" }
];

let transactionLogs = [];

const adminBotAction = () => new Promise(res => setTimeout(() => res(true), 300));

// --- API ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/login', (req, res) => {
    const u = users.find(u => u.username === req.body.username && u.password === req.body.password);
    if(u) { const {password, ...r} = u; res.json(r); } else res.status(401).json({error:"Hata"});
});

app.get('/inventory/:userId', (req, res) => {
    const u = users.find(u => u.id == req.params.userId);
    res.json(u ? u.inventory : []);
});

app.get('/market', (req, res) => {
    let r = marketListings.filter(i => i.status === 'SALE');
    const { search, category, minPrice, maxPrice, days } = req.query;
    if(search) r = r.filter(i => i.itemName.toLowerCase().includes(search.toLowerCase()));
    if(category && category !== 'all') r = r.filter(i => i.type === category);
    if(days && days !== 'all') r = r.filter(i => i.days == parseInt(days));
    if(minPrice) r = r.filter(i => i.price >= parseInt(minPrice));
    if(maxPrice) r = r.filter(i => i.price <= parseInt(maxPrice));
    res.json(r);
});

app.get('/my-history/:userId', (req, res) => {
    const uid = parseInt(req.params.userId);
    res.json(transactionLogs.filter(t => t.buyerId === uid || t.sellerId === uid).reverse());
});

app.post('/sell', async (req, res) => {
    const { userId, itemUid, price } = req.body;
    const u = users.find(u => u.id == userId);
    const idx = u.inventory.findIndex(i => i.uid == itemUid);
    const item = u.inventory[idx];

    await adminBotAction();
    u.inventory.splice(idx, 1);
    marketListings.push({
        id: Date.now(), sellerId: u.id, itemUid: item.uid, 
        itemName: item.name, type: item.type, days: item.days, 
        price: parseInt(price), status: 'SALE', img: item.img 
    });
    transactionLogs.push({
        id: Date.now(), type: "SATIŞ", user: u.username, 
        sellerId: u.id, item: item.name, price: price, date: new Date().toLocaleString()
    });
    res.json({success: true});
});

app.post('/buy', async (req, res) => {
    const { buyerId, listingId } = req.body;
    const b = users.find(u => u.id == buyerId);
    const l = marketListings.find(l => l.id == listingId);

    if(b.tg < l.price) return res.status(400).json({error:"Bakiye Yetersiz"});
    
    b.tg -= l.price;
    const s = users.find(u => u.id == l.sellerId);
    if(s) s.tg += l.price;

    await adminBotAction();
    l.status = 'SOLD';
    b.inventory.push({ uid: Date.now(), name: l.itemName, type: l.type, days: l.days, img: l.img });
    transactionLogs.push({
        id: Date.now(), type: "ALIM", buyer: b.username, seller: s ? s.username : "System",
        buyerId: b.id, sellerId: s ? s.id : 0, item: l.itemName, price: l.price, date: new Date().toLocaleString()
    });
    res.json({success: true});
});

// Admin API
app.get('/admin/users', (req, res) => res.json(users));
app.get('/admin/logs', (req, res) => res.json(transactionLogs.reverse()));
app.post('/admin/ban', (req, res) => {
    const idx = users.findIndex(u => u.id == req.body.targetId);
    if (idx !== -1 && users[idx].role !== 'admin') { users.splice(idx, 1); res.json({success:true}); }
    else res.status(400).json({error:"Silinemez"});
});

app.listen(3000, () => console.log("Final System: http://localhost:3000"));