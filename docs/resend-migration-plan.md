# Migration Plan: Brevo → Resend

> **Mục tiêu:** Thay thế Brevo bằng Resend làm email provider cho auth-service.  
> **Lý do:** Email OTP không đến Gmail — Brevo free tier dùng shared IP, deliverability kém với Gmail.  
> Resend đã verify domain `ngocanh2005it.site`, dùng dedicated sending infrastructure, deliverability tốt hơn nhiều.
>
> **Scope:** Chỉ auth-service (service duy nhất gửi email). Không ảnh hưởng service khác.  
> **Thời gian ước tính:** ~2 giờ (code + test + deploy)

---

## Checklist

### Phase 1 — Chuẩn bị

- [ ] Tạo Resend API key tại resend.com → API Keys → Create API Key
  - Permission: **Full Access**
  - Domain: `ngocanh2005it.site` (đã verified)
  - Lưu key vào nơi an toàn (không commit vào git)
- [ ] Xác nhận sender email muốn dùng, ví dụ: `no-reply@ngocanh2005it.site`

---

### Phase 2 — Code

#### 2.1 Cài package

```bash
cd services/auth-service
pnpm add resend
pnpm remove @getbrevo/brevo
```

#### 2.2 Tạo `resend-email.client.ts`

Tạo file `services/auth-service/src/infrastructure/emails/resend-email.client.ts`:

```typescript
import type { SendEmailJobPayload } from '@/infrastructure/emails/email-job.types';
import { Logger } from '@nestjs/common';
import { Resend } from 'resend';

export type ResendSendResult = {
  messageId: string;
};

export class ResendEmailClient {
  private readonly logger = new Logger(ResendEmailClient.name);
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async sendTransactionalEmail(
    options: SendEmailJobPayload,
    sender: { email: string; name: string },
  ): Promise<ResendSendResult> {
    const recipient = this.describeRecipient(options.to);
    const from = `${sender.name} <${sender.email}>`;

    const { data, error } = await this.client.emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to ?? ''],
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
      reply_to: options.replyTo,
      subject: options.subject ?? '',
      html: options.html,
      text: options.text,
    });

    if (error) {
      this.logger.error(
        `Resend rejected email to ${recipient}: ${error.name} — ${error.message}`,
      );
      throw new Error(`Resend error: ${error.message}`);
    }

    const messageId = data?.id ?? 'resend-sent';
    this.logger.log(
      `Resend accepted transactional email to ${recipient} (messageId=${messageId})`,
    );

    return { messageId };
  }

  private describeRecipient(value: string | string[] | undefined): string {
    if (!value) return 'unknown';
    return Array.isArray(value) ? value.join(',') : value;
  }
}
```

#### 2.3 Sửa `emails-sender.service.ts`

Thay toàn bộ tham chiếu Brevo bằng Resend:

- Đổi `import { BrevoEmailClient }` → `import { ResendEmailClient }`
- Đổi `private brevoClient: BrevoEmailClient | null` → `private resendClient: ResendEmailClient | null`
- Đổi `isBrevoConfigured()` → `isResendConfigured()` — check `RESEND_API_KEY` thay vì `BREVO_API_KEY`
- Đổi `getBrevoConfig()` → `getResendConfig()` trong `ConfigurationService`
- Đổi log message `'Brevo email delivery is not configured (BREVO_API_KEY missing)'` → Resend tương ứng

#### 2.4 Sửa `configuration.service.ts`

Thêm method `getResendConfig()`, xóa `getBrevoConfig()`:

```typescript
// Xóa:
getBrevoConfig(): BrevoConfig { ... }

// Thêm:
getResendConfig(): ResendConfig {
  return {
    apiKey: this.configService.get<string>('resend.apiKey') || undefined,
    senderEmail: this.configService.get<string>('resend.senderEmail') ?? '',
    senderName: this.configService.get<string>('resend.senderName') ?? 'CollabSpace',
  };
}
```

Cập nhật type `BrevoConfig` → `ResendConfig` (đổi tên, giữ nguyên shape).

#### 2.5 Sửa `env.config.ts`

```typescript
// Xóa:
brevo: {
  apiKey: process.env.BREVO_API_KEY,
  senderEmail: process.env.BREVO_SENDER_EMAIL ?? '',
  senderName: process.env.BREVO_SENDER_NAME ?? 'CollabSpace',
},

// Thêm:
resend: {
  apiKey: process.env.RESEND_API_KEY,
  senderEmail: process.env.RESEND_SENDER_EMAIL ?? '',
  senderName: process.env.RESEND_SENDER_NAME ?? 'CollabSpace',
},
```

#### 2.6 Sửa `.env.example`

```bash
# Xóa:
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=

# Thêm:
RESEND_API_KEY=
RESEND_SENDER_EMAIL=no-reply@ngocanh2005it.site
RESEND_SENDER_NAME=CollabSpace
```

---

### Phase 3 — Infrastructure

#### 3.1 Vault — thêm secret mới

Thêm `resend_api_key` vào Vault (thay thế `brevo_api_key`):

```bash
# Thêm Resend key vào Vault
vault kv patch secret/collabspace \
  resend_api_key="re_xxxxxxxxxxxxxxxx"
```

Hoặc nếu dùng `vault kv put` (ghi đè toàn bộ KV):
```bash
vault kv get -format=json secret/collabspace   # lấy giá trị hiện tại
vault kv put secret/collabspace \
  ... (giữ nguyên các key cũ) \
  resend_api_key="re_xxxxxxxxxxxxxxxx"
```

#### 3.2 External Secrets — `infrastructure/vault/k8s/external-secrets.yaml` và `external-secrets.prod.yaml`

```yaml
# Xóa:
- secretKey: BREVO_API_KEY
  remoteRef:
    key: secret/collabspace
    property: brevo_api_key

# Thêm:
- secretKey: RESEND_API_KEY
  remoteRef:
    key: secret/collabspace
    property: resend_api_key
```

#### 3.3 Helm — `infrastructure/helm/collabspace/templates/apps/secret.yaml`

```yaml
# Xóa:
BREVO_API_KEY: {{ $root.Values.global.secrets.brevoApiKey | quote }}

# Thêm:
RESEND_API_KEY: {{ $root.Values.global.secrets.resendApiKey | quote }}
```

#### 3.4 Helm — `values.yaml` và `values-prod.example.yaml`

```yaml
# values.yaml — xóa:
global:
  secrets:
    brevoApiKey: ""

# values.yaml — thêm:
global:
  secrets:
    resendApiKey: ""

# Env vars cho auth-service — xóa:
BREVO_SENDER_EMAIL: no-reply@collabspace.local
BREVO_SENDER_NAME: CollabSpace

# Env vars cho auth-service — thêm:
RESEND_SENDER_EMAIL: no-reply@ngocanh2005it.site
RESEND_SENDER_NAME: CollabSpace
```

#### 3.5 Vault seed scripts

Cập nhật `infrastructure/vault/scripts/seed-dev-secrets.sh` và `seed-vault-k3s-from-phase0.sh`:
- Đổi `BREVO_API_KEY` → `RESEND_API_KEY`
- Đổi `brevo_api_key` → `resend_api_key`

---

### Phase 4 — Test local

```bash
cd services/auth-service

# Set env tạm để test
export RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
export RESEND_SENDER_EMAIL=no-reply@ngocanh2005it.site
export RESEND_SENDER_NAME=CollabSpace

pnpm run build
pnpm run test
```

Kiểm tra unit test file `emails-sender.service.spec.ts` còn mock đúng không — cập nhật nếu có mock Brevo.

---

### Phase 5 — Deploy lên DOKS

```bash
# 1. Push code lên GitHub → CI/CD tự build image mới

# 2. Sau khi image mới lên registry, apply ESO để sync secret mới từ Vault:
kubectl annotate externalsecret auth-secrets -n collabspace \
  force-sync=$(date +%s) --overwrite

# 3. Verify secret đã có RESEND_API_KEY:
kubectl get secret auth-secrets -n collabspace -o jsonpath='{.data}' | \
  python -m json.tool

# 4. Rollout restart để pod nhận env mới:
kubectl rollout restart deployment/auth-service -n collabspace
kubectl rollout status deployment/auth-service -n collabspace

# 5. Smoke test — gửi OTP thật:
curl -X POST https://collabspace.ngocanh2005it.site/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"lengocanhpyne363@gmail.com","password":"Test@123456","fullName":"Test"}'

# 6. Kiểm tra log:
kubectl logs -n collabspace -l app=auth-service --tail=20 | grep -E "Resend|OTP|email"
```

---

### Phase 6 — Dọn dẹp

- [ ] Xóa `brevo_api_key` khỏi Vault (sau khi xác nhận Resend hoạt động ổn ít nhất 1 ngày)
- [ ] Xóa package `@getbrevo/brevo` khỏi `package.json` (đã làm ở Phase 2.1)
- [ ] Xóa file `brevo-email.client.ts`
- [ ] Cập nhật `infrastructure/vault/README.md` — đổi `BREVO_API_KEY` → `RESEND_API_KEY` trong bảng secrets

---

## Files cần sửa — tổng hợp

| File | Thay đổi |
|------|---------|
| `services/auth-service/package.json` | `+resend`, `-@getbrevo/brevo` |
| `services/auth-service/src/infrastructure/emails/resend-email.client.ts` | **Tạo mới** |
| `services/auth-service/src/infrastructure/emails/brevo-email.client.ts` | **Xóa** |
| `services/auth-service/src/infrastructure/emails/emails-sender.service.ts` | Dùng Resend thay Brevo |
| `services/auth-service/src/configuration/configuration.service.ts` | `getResendConfig()` thay `getBrevoConfig()` |
| `services/auth-service/src/configuration/env.config.ts` | `RESEND_*` thay `BREVO_*` |
| `services/auth-service/.env.example` | `RESEND_*` thay `BREVO_*` |
| `infrastructure/helm/collabspace/templates/apps/secret.yaml` | `RESEND_API_KEY` thay `BREVO_API_KEY` |
| `infrastructure/helm/collabspace/values.yaml` | `resendApiKey`, `RESEND_SENDER_*` |
| `infrastructure/helm/collabspace/values-prod.example.yaml` | `RESEND_SENDER_*` |
| `infrastructure/vault/k8s/external-secrets.yaml` | `resend_api_key` thay `brevo_api_key` |
| `infrastructure/vault/k8s/external-secrets.prod.yaml` | `resend_api_key` thay `brevo_api_key` |
| `infrastructure/vault/scripts/seed-dev-secrets.sh` | `RESEND_API_KEY` thay `BREVO_API_KEY` |
| `infrastructure/vault/scripts/seed-vault-k3s-from-phase0.sh` | `RESEND_API_KEY` thay `BREVO_API_KEY` |
| `infrastructure/vault/README.md` | Cập nhật bảng secrets |

---

## Rollback

Nếu Resend có vấn đề, rollback nhanh:

```bash
# Sửa lại env var trong Vault → brevo_api_key
# Rollout lại image cũ (hoặc giữ lại image tag cũ trước khi deploy)
kubectl rollout undo deployment/auth-service -n collabspace
```

> **Lưu ý:** Giữ `BREVO_API_KEY` trong Vault cho đến khi xác nhận Resend ổn định.

---

> 📄 Liên quan: `services/auth-service/CLAUDE.md`, `infrastructure/vault/README.md`, `docs/production-hardening.md`
