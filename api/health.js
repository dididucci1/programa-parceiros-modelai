module.exports = async (req, res) => {
  res.status(501).json({ error: 'Backend API disabled on Vercel. Use external backend.' });
};
