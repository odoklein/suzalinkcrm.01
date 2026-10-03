import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokensFromCode, getUserEmail } from '@/lib/google-drive';
import { encryptTokens } from '@/lib/encryption';

// ============================================
// GET /api/integrations/google-drive/callback
// Handle OAuth callback from Google
// ============================================

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Handle OAuth errors
        if (error) {
            console.error('Google OAuth error:', error);
            return NextResponse.redirect(
                new URL(`/manager/files?error=oauth_failed&message=${encodeURIComponent(error)}`, request.url)
            );
        }

        // Validate required parameters
        if (!code || !state) {
            return NextResponse.redirect(
                new URL('/manager/files?error=invalid_callback', request.url)
            );
        }

        // Decode and validate state
        let userId: string;
        try {
            const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
            userId = decodedState.userId;

            // Validate timestamp (state should be less than 10 minutes old)
            const stateAge = Date.now() - decodedState.timestamp;
            if (stateAge > 10 * 60 * 1000) {
                throw new Error('State expired');
            }
        } catch (err) {
            console.error('Invalid state parameter:', err);
            return NextResponse.redirect(
                new URL('/manager/files?error=invalid_state', request.url)
            );
        }

        // Exchange code for tokens
        const tokens = await getTokensFromCode(code);

        // Encrypt tokens for storage
        const encryptedTokens = encryptTokens(tokens);

        // Get user's Google email
        const googleEmail = await getUserEmail(encryptedTokens);

        // Update user record
        await prisma.user.update({
            where: { id: userId },
            data: {
                googleDriveConnected: true,
                googleDriveTokens: encryptedTokens,
                googleDriveEmail: googleEmail,
            },
        });

        // Redirect to files page with success message
        return NextResponse.redirect(
            new URL('/manager/files?success=google_drive_connected', request.url)
        );
    } catch (error) {
        console.error('Google Drive callback error:', error);
        return NextResponse.redirect(
            new URL('/manager/files?error=connection_failed', request.url)
        );
    }
}
