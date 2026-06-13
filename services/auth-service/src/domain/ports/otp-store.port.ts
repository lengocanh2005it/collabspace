export const OTP_STORE = Symbol('OTP_STORE');

export type EmailVerificationOtpPayload = {
  email: string;
  otpHash: string;
};

export interface OtpStore {
  assertAvailable(): Promise<void>;
  delete(key: string | string[]): Promise<number>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
  getJson<T>(key: string): Promise<T | null>;
  increment(key: string): Promise<number>;
  ping(): Promise<boolean>;
  set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null>;
  setJson(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<'OK' | null>;
  ttl(key: string): Promise<number>;
}
