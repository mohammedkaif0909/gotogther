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

    // 1. Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // 2. Sanitize and normalize inputs
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone != null && String(phone).trim() ? String(phone).trim() : null;
    const cleanCollege = collegeName != null && String(collegeName).trim() ? String(collegeName).trim() : null;
    const cleanOrg = organization != null && String(organization).trim() ? String(organization).trim() : null;

    let assignedRole: Role = Role.TRAVELER;
    if (role && typeof role === 'string') {
      const normalizedRole = role.trim().toUpperCase() as Role;
      if (Object.values(Role).includes(normalizedRole)) {
        assignedRole = normalizedRole;
      }
    }

    // 3. Check for existing account
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Create user record
    const newUser = await prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        role: assignedRole,
        phone: cleanPhone,
        collegeName: cleanCollege,
        organization: cleanOrg,
        avatarUrl: getProfessionalAvatarUrl(cleanName),
      },
    });

    // 6. Generate signed JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      user: excludePassword(newUser),
    });
  } catch (error: any) {
    // Detailed error logging to Render console
    console.error('Registration failed with details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });

    // Prisma Unique Constraint Violation (P2002)
    if (error?.code === 'P2002') {
      const target = Array.isArray(error?.meta?.target)
        ? error.meta.target.join(', ')
        : error?.meta?.target ?? 'email';
      return res.status(409).json({ error: `An account with this ${target} already exists` });
    }

    // Prisma Table Not Found (Database schema not pushed)
    if (
      error?.code === 'P2021' ||
      (typeof error?.message === 'string' &&
        (error.message.includes('does not exist in the current database') ||
          error.message.includes('relation "User" does not exist') ||
          error.message.includes('table "User" does not exist')))
    ) {
      return res.status(500).json({
        error:
          'Database tables have not been created yet. Please run "npx prisma db push" against your Supabase database.',
      });
    }

    // Database Connection / Configuration / Protocol Errors
    if (
      error?.code === 'P1000' ||
      error?.code === 'P1001' ||
      error?.code === 'P1002' ||
      error?.code === 'P1003' ||
      error?.code === 'P1017' ||
      (typeof error?.message === 'string' &&
        (error.message.includes('protocol') ||
          error.message.includes('the URL must start with the protocol') ||
          error.message.includes("Can't reach database server") ||
          error.message.includes('tenant/user') ||
          error.message.includes('Connection terminated') ||
          error.message.includes('DATABASE_URL')))
    ) {
      return res.status(503).json({
        error:
          'Database configuration error. Please ensure DATABASE_URL is configured with a valid PostgreSQL instance on Render.',
      });
    }

    return res.status(500).json({
      error: error?.message ? `Registration error: ${error.message}` : 'Internal server error during registration',
    });
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
  } catch (error: any) {
    console.error('Login failed with details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return res.status(500).json({
      error: error?.message ? `Login error: ${error.message}` : 'Internal server error during login',
    });
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
