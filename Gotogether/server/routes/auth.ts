import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { verifyToken, JWT_SECRET } from '../middleware/auth.middleware';
import { Role } from '../types/enums';
import { getProfessionalAvatarUrl } from '../utils/avatar';

export const authRouter = Router();

function excludePassword<U extends { password?: string }>(user: U): Omit<U, 'password'> {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * POST /api/auth/register
 * Registers a new user account.
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, phone, collegeName, organization } = req.body ?? {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = role && Object.values(Role).includes(role) ? role : Role.TRAVELER;

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: assignedRole,
        phone: phone ? String(phone).trim() : null,
        collegeName: collegeName ? String(collegeName).trim() : null,
        organization: organization ? String(organization).trim() : null,
        avatarUrl: getProfessionalAvatarUrl(name.trim()),
      },
    });

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      user: excludePassword(newUser),
    });
  } catch (error) {
    console.error('Registration failed:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
});

/**
 * POST /api/auth/login
 * Authenticates a user and returns a signed JWT.
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: excludePassword(user),
    });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

/**
 * GET /api/auth/me
 * Returns profile of currently authenticated user.
 */
authRouter.get('/me', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: excludePassword(user) });
  } catch (error) {
    console.error('Fetch user failed:', error);
    return res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
});

/**
 * PUT /api/auth/role
 * Upgrades/switches the user's active role (e.g., TRAVELER -> HOST).
 */
authRouter.put('/role', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { role } = req.body ?? {};

    if (!role || !Object.values(Role).includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${Object.values(Role).join(', ')}` });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    const token = jwt.sign(
      { userId: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: excludePassword(updatedUser),
    });
  } catch (error) {
    console.error('Role update failed:', error);
    return res.status(500).json({ error: 'Failed to update user role' });
  }
});
