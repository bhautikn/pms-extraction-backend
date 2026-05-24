import { Schema, model, Document, Types } from 'mongoose';
import { ExtractionStatus } from '../enums/extractionStatus.enum';

export interface ITokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface IExtraction extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  filename: string;
  pdfUrl: string; // Azure Blob URL
  status: ExtractionStatus;
  result?: Record<string, unknown>; // Claude JSON output
  errorMessage?: string;
  tokenUsage?: ITokenUsage;
  createdAt: Date;
  updatedAt: Date;
}

const extractionSchema = new Schema<IExtraction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    filename: { type: String, required: true, trim: true },
    pdfUrl: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(ExtractionStatus),
      default: ExtractionStatus.PENDING,
    },
    result: { type: Schema.Types.Mixed, default: undefined },
    errorMessage: { type: String, default: undefined },
    tokenUsage: {
      inputTokens: { type: Number },
      outputTokens: { type: Number },
    },
  },
  { timestamps: true },
);

// Compound index for IDOR-safe queries
extractionSchema.index({ userId: 1, createdAt: -1 });

export const ExtractionModel = model<IExtraction>('Extraction', extractionSchema);
