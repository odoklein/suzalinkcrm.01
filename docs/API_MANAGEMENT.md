# API Management System

## Overview

The CRM includes a comprehensive API key management system that allows managers to expose specific API endpoints for external integrations while maintaining security and control through:

- **API Key Authentication** - Secure token-based access
- **Role-Based Access Control** - Keys inherit user role permissions
- **Endpoint Scoping** - Restrict keys to specific API endpoints
- **Client/Mission Scoping** - Limit data access to specific clients or missions
- **Rate Limiting** - Per-minute and per-hour request limits
- **Usage Tracking** - Detailed logging and analytics
- **Expiration** - Optional time-based key expiration

## Security Features

### Key Generation
- **Format**: `cp_live_{48-char-random}_{timestamp}`
- **Storage**: SHA-256 hashed in database
- **Display**: Only shown once at creation
- **Prefix**: First 12 characters visible for identification

### Validation
- Format validation (alphanumeric + underscore only)
- Minimum length enforcement (32 characters)
- Active status check
- Expiration date verification
- Endpoint access validation
- Rate limit enforcement (per-minute and per-hour)

### Rate Limiting
- **Per-Minute**: 1-1000 requests (default: 60)
- **Per-Hour**: 1-10000 requests (default: 1000)
- Enforced at validation time
- Tracked via usage logs

## Database Schema

### ApiKey Table
```prisma
model ApiKey {
  id                  String    @id @default(cuid())
  name                String    // e.g., "OpenClaw Integration"
  keyHash             String    @unique
  keyPrefix           String    // First 12 chars for display
  role                UserRole  @default(MANAGER)
  clientId            String?
  missionId           String?
  allowedEndpoints    Json      // Array of endpoint paths
  rateLimitPerMinute  Int       @default(60)
  rateLimitPerHour    Int       @default(1000)
  isActive            Boolean   @default(true)
  lastUsedAt          DateTime?
  expiresAt           DateTime?
  createdById         String
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}
```

### ApiKeyUsageLog Table
```prisma
model ApiKeyUsageLog {
  id              String    @id @default(cuid())
  apiKeyId        String
  endpoint        String
  method          String
  statusCode      Int
  responseTimeMs  Int
  ipAddress       String?
  userAgent       String?
  createdAt       DateTime  @default(now())
}
```

### ExternalEndpoint Table
```prisma
model ExternalEndpoint {
  id                      String    @id @default(cuid())
  path                    String    @unique
  name                    String
  description             String?
  methods                 String[]  @default(["GET"])
  minRole                 UserRole  @default(MANAGER)
  supportsClientScope     Boolean   @default(true)
  supportsMissionScope    Boolean   @default(true)
  isEnabled               Boolean   @default(false)
  defaultRateLimitPerMinute Int     @default(60)
  defaultRateLimitPerHour   Int     @default(1000)
}
```

## API Endpoints

### Manager Endpoints

#### List API Keys
```http
GET /api/manager/api-keys
Authorization: Session Cookie
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "name": "OpenClaw Integration",
      "keyPrefix": "cp_live_abc1",
      "role": "MANAGER",
      "allowedEndpoints": ["/api/stats"],
      "rateLimitPerMinute": 60,
      "rateLimitPerHour": 1000,
      "isActive": true,
      "lastUsedAt": "2026-03-26T10:00:00Z",
      "expiresAt": null,
      "createdAt": "2026-03-26T09:00:00Z",
      "usageCount": 142
    }
  ]
}
```

#### Create API Key
```http
POST /api/manager/api-keys
Authorization: Session Cookie
Content-Type: application/json

{
  "name": "OpenClaw Integration",
  "role": "MANAGER",
  "clientId": "clx...",  // Optional
  "missionId": "clx...", // Optional
  "allowedEndpoints": ["/api/stats", "/api/stats/missions-summary"],
  "rateLimitPerMinute": 60,
  "rateLimitPerHour": 1000,
  "expiresAt": "2027-03-26T00:00:00Z"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "name": "OpenClaw Integration",
    "apiKey": "cp_live_abc123def456...",  // ⚠️ ONLY SHOWN ONCE
    "keyPrefix": "cp_live_abc1",
    "role": "MANAGER",
    "allowedEndpoints": ["/api/stats"],
    "rateLimitPerMinute": 60,
    "rateLimitPerHour": 1000,
    "expiresAt": "2027-03-26T00:00:00Z",
    "createdAt": "2026-03-26T10:00:00Z"
  }
}
```

#### Revoke API Key
```http
DELETE /api/manager/api-keys/{id}
Authorization: Session Cookie
```

#### Get Available Endpoints
```http
GET /api/manager/api-keys/endpoints
Authorization: Session Cookie
```

### Using API Keys

#### Authentication Headers

**Option 1: X-API-Key Header**
```http
GET /api/stats?period=month
X-API-Key: cp_live_abc123def456...
```

**Option 2: Bearer Token**
```http
GET /api/stats?period=month
Authorization: Bearer cp_live_abc123def456...
```

#### Example with cURL
```bash
curl -H "X-API-Key: cp_live_abc123def456..." \
  "https://yourdomain.com/api/stats?period=month"
```

#### Example with JavaScript
```javascript
const response = await fetch('https://yourdomain.com/api/stats?period=month', {
  headers: {
    'X-API-Key': 'cp_live_abc123def456...'
  }
});
const data = await response.json();
```

#### Example with Python
```python
import requests

headers = {
    'X-API-Key': 'cp_live_abc123def456...'
}

response = requests.get(
    'https://yourdomain.com/api/stats?period=month',
    headers=headers
)
data = response.json()
```

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Access denied: endpoint /api/stats not allowed for this API key"
}
```

### 429 Rate Limit Exceeded
```json
{
  "success": false,
  "error": "Rate limit exceeded: 60 requests per minute"
}
```

## Available Endpoints

### Statistics API
- **Path**: `/api/stats`
- **Methods**: GET
- **Description**: Dashboard statistics including actions, meetings, and conversion rates
- **Query Parameters**:
  - `period`: today | week | month | quarter
  - `startDate`: ISO date string
  - `endDate`: ISO date string
  - `missionId`: Filter by mission

### Missions Summary API
- **Path**: `/api/stats/missions-summary`
- **Methods**: GET
- **Description**: Active missions with activity metrics
- **Query Parameters**:
  - `period`: today | week | month | quarter
  - `limit`: Max results (default: 20, max: 50)

## Best Practices

### Security
1. **Never commit API keys** to version control
2. **Store keys securely** in environment variables or secrets management
3. **Rotate keys regularly** (create new, delete old)
4. **Use minimum required permissions** (role and endpoint scoping)
5. **Set expiration dates** for temporary integrations
6. **Monitor usage logs** for suspicious activity

### Rate Limiting
1. **Start conservative** with lower limits
2. **Monitor usage patterns** before increasing
3. **Implement retry logic** with exponential backoff
4. **Cache responses** when possible
5. **Use webhooks** instead of polling when available

### Scoping
1. **Client scope** - Limit to specific client data
2. **Mission scope** - Limit to specific mission data
3. **Endpoint scope** - Only expose necessary endpoints
4. **Role scope** - Use lowest privilege role needed

## Monitoring & Analytics

### Usage Logs
Track every API request with:
- Endpoint accessed
- HTTP method
- Response status code
- Response time (ms)
- IP address
- User agent
- Timestamp

### Metrics Available
- Total requests per key
- Requests per endpoint
- Average response time
- Error rates
- Rate limit hits
- Last used timestamp

## Troubleshooting

### Key Not Working
1. Verify key is active (not revoked)
2. Check expiration date
3. Confirm endpoint is in `allowedEndpoints`
4. Verify rate limits not exceeded
5. Check role permissions

### Rate Limit Issues
1. Review current usage in logs
2. Adjust limits if legitimate traffic
3. Implement caching on client side
4. Use batch endpoints when available
5. Consider upgrading limits

### Permission Errors
1. Verify role has access to endpoint
2. Check client/mission scoping
3. Confirm endpoint is enabled
4. Review role hierarchy

## Migration Guide

### Running the Migration
```bash
npx prisma migrate dev --name add_api_key_management
```

### Seeding Default Endpoints
The migration automatically creates default `ExternalEndpoint` entries for:
- `/api/stats` - Dashboard Statistics
- `/api/stats/missions-summary` - Missions Summary
- `/api/prospects/intake` - Prospect Intake

### Post-Migration Steps
1. Enable desired endpoints in database
2. Create first API key via UI
3. Test with external tool
4. Monitor usage logs
5. Adjust rate limits as needed

## UI Features

### API Management Page
Located at `/manager/api`

**Features:**
- List all API keys with status
- Create new keys with configuration
- Revoke existing keys
- View usage statistics
- Copy key to clipboard (on creation only)
- API documentation and examples

**Key Creation Form:**
- Name (required)
- Role selection
- Client scope (optional)
- Mission scope (optional)
- Endpoint selection (multi-select)
- Rate limits (per-minute and per-hour)
- Expiration date (optional)

## Support & Maintenance

### Regular Tasks
- Review usage logs weekly
- Rotate keys quarterly
- Audit active keys monthly
- Update rate limits based on usage
- Clean up old usage logs (>90 days)

### Performance Considerations
- Usage logs can grow large - implement archival
- Rate limit checks query recent logs - ensure indexes
- Consider Redis for rate limiting at scale
- Monitor database query performance

## Future Enhancements

### Planned Features
- Webhook support for real-time events
- API key rotation with grace period
- IP whitelist/blacklist
- More granular permissions
- GraphQL endpoint support
- API key templates
- Bulk operations
- Advanced analytics dashboard
