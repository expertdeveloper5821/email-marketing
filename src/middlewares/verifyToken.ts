import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

export interface UserType {
  user_id: string;
}

export interface CustomRequest extends Request {
  user?: UserType;
}

const authMiddleware = async (req: CustomRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Missing Authorization header' });
  }

  const [bearer, token] = authHeader.split(' ');
  if (bearer !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Invalid Authorization header' });
  }

  try {
    const response = await axios.post(`http://192.168.1.56:5050/auth/verify?token=${token}`);
    const decoded = response.data.decoded;
    req.user = decoded as UserType;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export default authMiddleware;
