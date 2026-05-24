import { Schema, model, Document, Types } from 'mongoose';

export interface IUserSettings {
  anthropicApiKey?: string; // AES-256-GCM encrypted
  claudeModel: string;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  settings: IUserSettings;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    passwordHash: { type: String, required: true },
    settings: {
      anthropicApiKey: { type: String, default: undefined },
      claudeModel: { type: String, default: 'claude-opus-4-5' },
    },
  },
  { timestamps: true },
);

// Prevent leaking passwordHash and encrypted API key in JSON output
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as any).passwordHash;
    if (ret.settings?.anthropicApiKey) {
      ret.settings.anthropicApiKey = undefined;
    }
    return ret;
  },
});

export const UserModel = model<IUser>('User', userSchema);
