// ============================================
// PROSPECT INTAKE API
// Public endpoint for external lead sources
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { intakeLead } from '@/lib/prospects/intake-service';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import crypto from 'crypto';

// ============================================
// SCHEMAS
// ============================================

const intakeSchema = z.object({
  sourceId: z.string().optional(), // Can come from query param or body
  payload: z.record(z.any()).refine(val => Object.keys(val).length > 0, 'Payload cannot be empty'),
  apiKey: z.string().optional(), // For API key authentication (can be in header or body)
});

// ============================================
// POST /api/prospects/intake
// Supports:
// 1. Query parameter: ?sourceId=xxx (for webhooks)
// 2. Body: { sourceId, payload, apiKey }
// 3. Header: X-API-Key (for API authentication)
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Get sourceId from query parameter (for webhooks) or body
    const { searchParams } = new URL(request.url);
    const querySourceId = searchParams.get('sourceId');
    
    // Get API key from header or body
    const headerApiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
    
    const body = await request.json();
    
    // If sourceId is in query param (webhook), the entire body is the payload
    // Otherwise, validate against schema
    let sourceId: string | null = null;
    let apiKey: string | undefined = undefined;
    let payload: any;
    
    if (querySourceId) {
      // Webhook mode: sourceId in URL, entire body is payload
      sourceId = querySourceId;
      payload = body;
    } else {
      // API mode: validate schema
      const validated = intakeSchema.parse(body);
      sourceId = validated.sourceId || null;
      apiKey = headerApiKey || validated.apiKey;
      payload = validated.payload;
    }
    
    if (!sourceId) {
      return NextResponse.json(
        { success: false, error: 'Source ID required (provide in query parameter ?sourceId=xxx or in request body)' },
        { status: 400 }
      );
    }
    
    // Validate payload is not empty
    if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Payload cannot be empty' },
        { status: 400 }
      );
    }

    // Verify source exists
    const source = await prisma.prospectSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      return NextResponse.json(
        { success: false, error: 'Invalid source ID' },
        { status: 404 }
      );
    }

    // Authenticate based on source type
    const sourceMetadata = (source.metadata as any) || {};
    
    if (source.type === 'API') {
      // API sources require API key authentication
      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: 'API key required for API sources' },
          { status: 401 }
        );
      }
      
      const expectedApiKey = sourceMetadata.apiKey;
      if (!expectedApiKey || apiKey !== expectedApiKey) {
        return NextResponse.json(
          { success: false, error: 'Invalid API key' },
          { status: 401 }
        );
      }
    } else if (source.type === 'WEB_FORM') {
      // Optional: Webhook signature verification for WEB_FORM sources
      const webhookSecret = sourceMetadata.webhookSecret;
      if (webhookSecret) {
        const signature = request.headers.get('X-Webhook-Signature') || 
                         request.headers.get('X-Signature');
        
        if (!signature) {
          return NextResponse.json(
            { success: false, error: 'Webhook signature required' },
            { status: 401 }
          );
        }
        
        // Verify HMAC SHA256 signature
        const rawBody = JSON.stringify(payload);
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');
        
        // Constant-time comparison to prevent timing attacks
        if (!crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        )) {
          return NextResponse.json(
            { success: false, error: 'Invalid webhook signature' },
            { status: 401 }
          );
        }
      }
    }

    // Process intake
    const result = await intakeLead(sourceId, payload);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Intake failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        eventId: result.eventId,
        profileId: result.profileId,
      },
    });
  } catch (error: any) {
    console.error('Intake API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
