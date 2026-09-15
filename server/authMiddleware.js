import jwt from 'jsonwebtoken';

export const verifyAuth = (req, res, next) => {
  // Allow bypassing auth in local dev if no JWT secret is set (optional)
  if (!process.env.SUPABASE_JWT_SECRET) {
    console.warn('WARNING: SUPABASE_JWT_SECRET is not set, bypassing auth check.');
    return next();
  }

  let token = req.query.token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization token' });
  }

  try {
    // Supabase signs their JWTs using the JWT secret
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    req.user = decoded; // Contains user info (sub is the user UUID)
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
