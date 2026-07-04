import bcrypt from 'bcryptjs';
import { UserModel } from '../models/user.model';
import { signToken } from '../utils/jwt';
import { MESSAGES } from '../constants/messages';

const SALT_ROUNDS = 12;

export async function signup(name: string, email: string, password: string) {
  const existing = await UserModel.findOne({ email: email.toLowerCase() });
  if (existing) throw new Error(MESSAGES.EMAIL_EXISTS);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await UserModel.create({ name, email, passwordHash });
  const token = signToken({ userId: user._id.toString(), email: user.email });

  return { token, user };
}

export async function login(email: string, password: string, rememberMe = false) {
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) throw new Error(MESSAGES.INVALID_CREDENTIALS);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error(MESSAGES.INVALID_CREDENTIALS);

  const token = signToken({ userId: user._id.toString(), email: user.email }, rememberMe);
  return { token, user };
}

