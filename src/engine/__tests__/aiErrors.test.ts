import { describeError, providerErrorDetail } from '../parser/aiShared';

const sdkError = (status: number, error: unknown, message = `${status} API error occurred`) => Object.assign(new Error(message), { status, error });

describe('provider error details', () => {
  it('reads Google’s array-wrapped error body', () => {
    const err = sdkError(503, [{ error: { code: 503, message: 'The model is overloaded. Please try again later.', status: 'UNAVAILABLE' } }]);
    expect(providerErrorDetail(err)).toBe('UNAVAILABLE: The model is overloaded. Please try again later.');
    const msg = describeError(err, 'Gemini');
    expect(msg).toContain('server problem (error 503)');
    expect(msg).toContain('Gemini said: “UNAVAILABLE: The model is overloaded. Please try again later.”');
  });

  it('reads Anthropic’s nested error body', () => {
    const err = sdkError(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } });
    expect(providerErrorDetail(err)).toBe('overloaded_error: Overloaded');
  });

  it('reads the raw JSON body the Gemini SDK actually keeps (error holds only httpMeta)', () => {
    const err = Object.assign(new Error('503 API error occurred'), {
      status: 503,
      error: { httpMeta: { response: {}, request: {} } },
      body: '[{"error": {"code": 503, "message": "The model is overloaded.", "status": "UNAVAILABLE"}}]',
    });
    expect(providerErrorDetail(err)).toBe('UNAVAILABLE: The model is overloaded.');
  });

  it('falls back to a "message" inside raw text', () => {
    const err = Object.assign(new Error('500 {"error": {"message": "Internal error encountered."}}'), { status: 500 });
    expect(providerErrorDetail(err)).toBe('Internal error encountered.');
  });

  it('shows the real reason for a 400 that is not about the key', () => {
    const err = sdkError(400, [{ error: { message: 'Invalid JSON payload received. Unknown name "store".', status: 'INVALID_ARGUMENT' } }]);
    expect(describeError(err, 'Gemini')).toBe('Gemini rejected the request (error 400). Gemini said: “INVALID_ARGUMENT: Invalid JSON payload received. Unknown name "store".”');
  });

  it('still recognises an invalid key from the detail text', () => {
    const err = sdkError(400, [{ error: { message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }]);
    expect(describeError(err, 'Gemini')).toMatch(/^Your Gemini API key was rejected/);
  });

  it('returns nothing when there is no detail', () => {
    expect(providerErrorDetail(new Error('boom'))).toBe('');
    expect(providerErrorDetail(undefined)).toBe('');
  });
});
