import jwt from 'jsonwebtoken';

export const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
  const expected = process.env.JWT_SECRET || 'dev-secret';

  if (!token) {
    return res.status(401).json({ message: 'Admin authentication required' });
  }

  try {
    const decoded = jwt.verify(token, expected);
    if (!decoded?.admin) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.admin = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
