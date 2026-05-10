// app/api/client/upload-image/route.ts
//
// Handles brand image uploads for card backgrounds and logos.
// Uploads to Cloudinary and saves the returned URL to the Client document.
// Accepts PNG and JPG/JPEG only.
// Size limits: 2MB for backgrounds, 500KB for logos.

import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { getAuthorizedUser } from '@/lib/auth/getAuthorizeduser';
import connectToDatabase from '@/lib/mongodb';
import Client from '@/app/models/Client';
import { Types } from 'mongoose';
import { logError } from '@/lib/sentry/logger';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

const IMAGE_CONFIG = {
  background: {
    folder: 'gg-pickleball/brand-backgrounds',
    maxBytes: 2 * 1024 * 1024, // 2MB
    label: 'Card background',
    clientField: ['cardBackgroundImage'] as const,
  },
  logo: {
    folder: 'gg-pickleball/brand-logos',
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

    // ── Upload to Cloudinary ──────────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());

    // Use a stable public_id so re-uploading replaces the old image rather
    // than accumulating orphaned files in Cloudinary.
    const publicId = `${config.folder}/${clientId}-${imageType}`;

    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          overwrite: true,
          resource_type: 'image',
          // Automatically strip EXIF metadata for privacy.
          invalidate: true,
        },
        (error, result) => {
          if (error || !result) reject(error ?? new Error('Cloudinary upload failed'));
          else resolve(result as { secure_url: string });
        }
      );
      uploadStream.end(buffer);
    });

    const imageUrl = uploadResult.secure_url;

    // ── Update the client record ──────────────────────────────────────────────
    const updateFields = config.clientField.reduce(
      (acc, field) => ({ ...acc, [field]: imageUrl }),
      {} as Record<string, string>
    );

    await Client.findByIdAndUpdate(clientId, { $set: updateFields });

    console.log(`[Upload] ${config.label} uploaded for client ${clientId}: ${imageUrl}`);

    return NextResponse.json({ url: imageUrl });
  } catch (err) {
    logError(err, { endpoint: 'POST /api/upload-image' });
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}