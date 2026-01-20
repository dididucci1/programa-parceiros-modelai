const { connectDB } = require('./_db');

module.exports = async (req, res) => {
  try{
    await connectDB();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  }catch(e){
    res.status(500).json({ error: e.message || 'error' });
  }
};
