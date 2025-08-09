import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import crypto from 'crypto';
import { ec as EC } from 'elliptic';
import { v4 as uuidv4 } from 'uuid';

const ec = new EC('secp256k1');
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

const CHAIN_FILE = process.env.CHAIN_FILE || './mnk_chain.json';
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

class Transaction {
  constructor(from, to, amount) {
    this.id = uuidv4();
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.timestamp = Date.now();
  }
}

class Block {
  constructor(index, previousHash, transactions, timestamp = Date.now()) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.nonce = 0;
    this.hash = this.computeHash();
  }
  computeHash() {
    const data = this.index + this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  mine(difficulty = 3) {
    while (!this.hash.startsWith('0'.repeat(difficulty))) {
      this.nonce++;
      this.hash = this.computeHash();
    }
  }
}

class Blockchain {
  constructor() {
    this.chain = [];
    this.pending = [];
    this.difficulty = 3;
    this.miningReward = 50;
    if (fs.existsSync(CHAIN_FILE)) {
      const data = JSON.parse(fs.readFileSync(CHAIN_FILE));
      this.chain = data.chain;
      this.pending = data.pending;
      this.difficulty = data.difficulty;
      this.miningReward = data.miningReward;
    } else {
      const genesis = new Block(0, "0", [], Date.now());
      this.chain.push(genesis);
      this.save();
    }
  }
  getLastBlock() { return this.chain[this.chain.length - 1]; }
  createTransaction(tx) { this.pending.push(tx); this.save(); }
  minePending(minerAddress) {
    const rewardTx = new Transaction(null, minerAddress, this.miningReward);
    this.pending.push(rewardTx);
    const block = new Block(this.chain.length, this.getLastBlock().hash, this.pending);
    block.mine(this.difficulty);
    this.chain.push(block);
    this.pending = [];
    this.save();
    return block;
  }
  getBalance(address) {
    let balance = 0;
    for (const b of this.chain) {
      for (const tx of b.transactions) {
        if (tx.from === address) balance -= tx.amount;
        if (tx.to === address) balance += tx.amount;
      }
    }
    for (const tx of this.pending) {
      if (tx.from === address) balance -= tx.amount;
      if (tx.to === address) balance += tx.amount;
    }
    return balance;
  }
  save() {
    fs.writeFileSync(CHAIN_FILE, JSON.stringify({
      chain: this.chain,
      pending: this.pending,
      difficulty: this.difficulty,
      miningReward: this.miningReward
    }, null, 2));
  }
}

const MNK = new Blockchain();

app.get('/chain', (req, res) => res.json({ chain: MNK.chain, pending: MNK.pending }));
app.post('/tx', (req, res) => {
  const { from, to, amount } = req.body;
  if (!from || !to || !amount) return res.status(400).json({ error: 'invalid' });
  MNK.createTransaction(new Transaction(from, to, amount));
  res.json({ status: 'tx queued' });
});
app.post('/mine', (req, res) => {
  const { miner } = req.body;
  if (!miner) return res.status(400).json({ error: 'miner address required' });
  const block = MNK.minePending(miner);
  res.json({ status: 'mined', block });
});
app.get('/balance/:addr', (req, res) => {
  res.json({ balance: MNK.getBalance(req.params.addr) });
});

app.get('/wallet/new', (req, res) => {
  const key = ec.genKeyPair();
  const priv = key.getPrivate('hex');
  const pub = key.getPublic('hex');
  res.json({ privateKey: priv, publicKey: pub });
});

app.listen(PORT, () => console.log(`MNK node running on port ${PORT}`));
