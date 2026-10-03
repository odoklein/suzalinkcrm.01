// ============================================
// PROSPECT NORMALIZATION SERVICE
// Standardizes field formats across different sources
// ============================================

export interface NormalizedProfile {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  title: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  companyIndustry: string | null;
  companyCountry: string | null;
  companySize: string | null;
}

// ============================================
// NORMALIZE PROFILE DATA
// ============================================

export function normalizeProfile(data: any): NormalizedProfile {
  return {
    firstName: normalizeName(data.firstName || data.first_name || data['First Name'] || data['FIRST_NAME']),
    lastName: normalizeName(data.lastName || data.last_name || data['Last Name'] || data['LAST_NAME']),
    email: normalizeEmail(data.email || data.Email || data.EMAIL || data['e-mail'] || data['E-mail']),
    phone: normalizePhone(data.phone || data.Phone || data.PHONE || data.telephone || data.tel || data.mobile),
    linkedin: normalizeLinkedIn(data.linkedin || data.LinkedIn || data.LINKEDIN || data['linkedin_url'] || data['LinkedIn URL']),
    title: normalizeTitle(data.title || data.Title || data.TITLE || data.jobTitle || data.job_title || data.position || data.Position),
    companyName: normalizeCompanyName(data.company || data.companyName || data.company_name || data.Company || data.COMPANY || data['Company Name']),
    companyWebsite: normalizeWebsite(data.website || data.Website || data.WEBSITE || data.companyWebsite || data.company_website || data['Company Website']),
    companyIndustry: normalizeIndustry(data.industry || data.Industry || data.INDUSTRY || data.companyIndustry || data.company_industry || data['Company Industry']),
    companyCountry: normalizeCountry(data.country || data.Country || data.COUNTRY || data.companyCountry || data.company_country || data['Company Country']),
    companySize: normalizeCompanySize(data.size || data.Size || data.SIZE || data.companySize || data.company_size || data['Company Size']),
  };
}

// ============================================
// FIELD NORMALIZERS
// ============================================

function normalizeName(value: any): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  // Capitalize first letter of each word
  return trimmed
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function normalizeEmail(value: any): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return null;
  
  return trimmed;
}

function normalizePhone(value: any): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  // Remove common separators
  let cleaned = trimmed.replace(/[\s\-\(\)\.]/g, '');
  
  // Remove leading + if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // Remove leading 00 (international format)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  
  // Keep only digits
  cleaned = cleaned.replace(/\D/g, '');
  
  if (cleaned.length < 8) return null; // Too short to be valid
  
  return cleaned;
}

function normalizeLinkedIn(value: any): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  // If it's already a full URL, return as is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  // If it's just a username, construct URL
  if (trimmed.startsWith('linkedin.com/') || trimmed.startsWith('www.linkedin.com/')) {
    return `https://${trimmed.replace(/^www\./, '')}`;
  }
  
  // If it starts with /, add linkedin.com
  if (trimmed.startsWith('/')) {
    return `https://linkedin.com${trimmed}`;
  }
  
  // Otherwise assume it's a username
  return `https://linkedin.com/in/${trimmed}`;
}

function normalizeTitle(value: any): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function normalizeCompanyName(value: any): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function normalizeWebsite(value: any): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  // If it already has protocol, return as is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  // Otherwise add https://
  return `https://${trimmed}`;
}

function normalizeIndustry(value: any): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function normalizeCountry(value: any): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  // Convert country codes to names if needed (basic mapping)
  const countryMap: Record<string, string> = {
    'FR': 'France',
    'US': 'United States',
    'UK': 'United Kingdom',
    'GB': 'United Kingdom',
    'DE': 'Germany',
    'ES': 'Spain',
    'IT': 'Italy',
  };
  
  const upper = trimmed.toUpperCase();
  return countryMap[upper] || trimmed;
}

function normalizeCompanySize(value: any): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}
