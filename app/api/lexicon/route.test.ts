import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
const mocks = vi.hoisted(() => ({auth: vi.fn(), forward: vi.fn(), reverse: vi.fn()}));
vi.mock("@/auth", () => ({auth: mocks.auth}));
vi.mock("./services", () => ({getDictItems: mocks.forward, getReverseDictItems: mocks.reverse}));
import {GET as forward} from "./route";
import {GET as reverse} from "./reverse/route";

beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue(null);
    mocks.forward.mockResolvedValue([]);
    mocks.reverse.mockResolvedValue([]);
});
const request = (query = '') => new NextRequest(`https://example.org/api/lexicon?${query}`);

describe.each([['forward', forward, mocks.forward], ['reverse', reverse, mocks.reverse]] as const)("%s lexicon HTTP pagination", (_name, get, service) => {
    it("uses safe defaults and preserves an array response", async () => {
        const response = await get(request());
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([]);
        expect(service.mock.calls[0].slice(_name === 'reverse' ? 2 : 1, _name === 'reverse' ? 4 : 3)).toEqual([0, 50]);
    });
    it.each(['limit=-1', 'limit=0', 'limit=101', 'limit=1.5', 'limit=NaN', 'limit=Infinity', 'limit=', 'offset=-1', 'offset=1.5', 'offset=NaN', 'offset=Infinity', 'offset=', 'offset=9007199254740992', 'limit=1&limit=2'])("rejects %s before auth or DB work", async query => {
        const response = await get(request(query));
        expect(response.status).toBe(400);
        expect(await response.json()).toHaveProperty('error');
        expect(mocks.auth).not.toHaveBeenCalled();
        expect(service).not.toHaveBeenCalled();
    });
    it("passes validated offset and limit to the service", async () => {
        await get(request('search=je&lang=ru&offset=40&limit=20'));
        expect(service.mock.calls[0].slice(_name === 'reverse' ? 2 : 1, _name === 'reverse' ? 4 : 3)).toEqual([40, 20]);
    });
    it.each(['ADMIN', 'MODERATOR', 'USER'])("preserves hidden-word scoping for %s", async role => {
        mocks.auth.mockResolvedValue({user: {role}});
        await get(request('limit=20'));
        expect(service.mock.calls[0][_name === 'reverse' ? 4 : 7]).toBe(role !== 'USER');
    });
});
