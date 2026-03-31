import { FHIRClient } from '../../src/infrastructure/fhir/FHIRClient';
import { FHIRResourceError } from '../../src/shared/errors/FHIRResourceError';

describe('FHIRClient Integration', () => {
  const BASE_URL = 'https://hapi.fhir.org/baseR4';
  let client: FHIRClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    client = new FHIRClient({ baseUrl: BASE_URL });
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockResponse = (status: number, data?: any, text?: string) => {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: text || 'Mocked',
      json: () => Promise.resolve(data),
    } as Response);
  };

  it('should fetch a resource successfully', async () => {
    const mockPatient = { resourceType: 'Patient', id: '123' };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, mockPatient));

    const result = await client.getResource('Patient', '123');
    expect(result).toEqual(mockPatient);
    expect(global.fetch).toHaveBeenCalledWith(`${BASE_URL}/Patient/123`, expect.anything());
  });

  it('should include Authorization header if token is provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, { success: true }));

    client.setToken('test-token');
    await client.getResource('Patient', '123');
    
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/Patient/123`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Authorization': 'Bearer test-token' })
      })
    );
  });

  it('should retry on 500 errors and eventually succeed', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(500))
      .mockResolvedValueOnce(mockResponse(500))
      .mockResolvedValueOnce(mockResponse(200, { success: true }));

    const result = await client.getResource('Patient', 'retry-test');
    expect(result).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should throw FHIRResourceError after exhaustion of retries', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(502));

    await expect(client.getResource('Patient', 'fail-test')).rejects.toThrow(FHIRResourceError);
    // 1 original + 3 retries
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  it('should not retry on 404 errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(404));

    await expect(client.getResource('Patient', 'not-found')).rejects.toThrow(FHIRResourceError);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
