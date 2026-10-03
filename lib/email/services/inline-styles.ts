// ============================================
// INLINE STYLES SERVICE
// Inlines <style> and class-based CSS into element style attributes
// for email client compatibility (Gmail, Outlook, etc.)
// ============================================

import juice from 'juice';

/**
 * Inline CSS from <style> tags and classes into HTML element style attributes.
 * Safe for email: if inlining fails (e.g. invalid HTML), returns original HTML.
 */
export function inlineHtmlForEmail(html: string): string {
    if (!html || typeof html !== 'string') {
        return html;
    }
    try {
        return juice(html, {
            applyStyleTags: true,
            applyWidthAttributes: true,
            applyHeightAttributes: true,
            preserveMediaQueries: true,
            removeStyleTags: true,
        });
    } catch (err) {
        console.warn('Email CSS inlining failed, using original HTML:', err);
        return html;
    }
}
