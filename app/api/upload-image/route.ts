// app/api/upload-image/route.ts
//
// Handles brand image uploads for card backgrounds and logos.
// Saves files to /public/brandImages or /public/brandLogos.
// Accepts PNG and JPG/JPEG only.
// Size limits: 2MB for backgrounds, 500KB for logos.

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { Types } from 'mongoose';
import { logError } from '@/lib/sentry/logger';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

const IMAGE_CONFIG = {
  background: {
    folder: 'brandImages',
    maxBytes: 2 * 1024 * 1024, // 2MB
    label: 'Card background',
    clientField: ['cardBackgroundImage'] as const,
  },
  logo: {
    folder: 'brandLogos',
    maxBytes: 500 * 1024, // 500KB
    label: 'Logo',
    clientField: ['logo', 'admin_logo'] as const,
  },
} as const;

type ImageType = keyof typeof IMAGE_CONFIG;

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const clientId = formData.get('clientId') as string | null;
    const imageType = formData.get('imageType') as ImageType | null;

    // ── Validate inputs ───────────────────────────────────────────────────────
    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }
    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      return NextResponse.json({ error: 'Valid clientId is required.' }, { status: 400 });
    }
    if (!imageType || !IMAGE_CONFIG[imageType]) {
      return NextResponse.json(
        { error: 'imageType must be "background" or "logo".' },
        { status: 400 }
      );
    }

    const config = IMAGE_CONFIG[imageType];

    // ── File type check ───────────────────────────────────────────────────────
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `${config.label} must be a PNG or JPG/JPEG file.` },
        { status: 400 }
      );
    }

    // ── File size check ───────────────────────────────────────────────────────
    if (file.size > config.maxBytes) {
      const limitMB = config.maxBytes / (1024 * 1024);
      const limitLabel = limitMB >= 1 ? `${limitMB}MB` : `${config.maxBytes / 1024}KB`;
      return NextResponse.json(
        { error: `${config.label} must be under ${limitLabel}.` },
        { status: 400 }
      );
    }

    // ── Verify the client exists ──────────────────────────────────────────────
    await connectToDatabase();
    const client = await Client.findById(clientId).select('_id').lean();
    if (!client) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }

    // ── Write file to public folder ───────────────────────────────────────────
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    // Use clientId + imageType + timestamp for a unique, collision-free filename.
    const filename = `${clientId}-${imageType}-${Date.now()}.${ext}`;
    const publicDir = path.join(process.cwd(), 'public', config.folder);

    // Ensure the directory exists (in case it was deleted).
    await mkdir(publicDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(publicDir, filename), buffer);

    const publicUrl = `/${config.folder}/${filename}`;

    // ── Update the client record ──────────────────────────────────────────────
    const updateFields = config.clientField.reduce(
      (acc, field) => ({ ...acc, [field]: publicUrl }),
      {} as Record<string, string>
    );

    await Client.findByIdAndUpdate(clientId, { $set: updateFields });

    console.log(`[Upload] ${config.label} saved for client ${clientId}: ${publicUrl}`);

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    logError(err, { endpoint: 'POST /api/upload-image' });
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}