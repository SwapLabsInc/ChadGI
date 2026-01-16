/**
 * Unit tests for src/utils/gh-client.ts
 *
 * Tests the high-level GitHub operations abstraction layer including
 * issue operations, PR operations, project operations, and error handling.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
// Mock the github.js module before importing gh-client
const mockExecGhWithRetry = jest.fn();
const mockExecGhJsonWithRetry = jest.fn();
const mockSafeExecGhJsonWithRetry = jest.fn();
jest.unstable_mockModule('../../utils/github.js', () => ({
    execGhWithRetry: mockExecGhWithRetry,
    execGhJsonWithRetry: mockExecGhJsonWithRetry,
    safeExecGhJsonWithRetry: mockSafeExecGhJsonWithRetry,
}));
// Import after mocking
const { gh, GhClientError } = await import('../../utils/gh-client.js');
describe('GhClientError', () => {
    describe('constructor', () => {
        it('should create an error with code and message', () => {
            const error = new GhClientError('Test error', 'NOT_FOUND');
            expect(error.message).toBe('Test error');
            expect(error.code).toBe('NOT_FOUND');
            expect(error.name).toBe('GhClientError');
        });
        it('should include cause when provided', () => {
            const cause = new Error('Original error');
            const error = new GhClientError('Wrapped error', 'UNKNOWN', cause);
            expect(error.cause).toBe(cause);
        });
    });
    describe('fromError', () => {
        it('should classify 404 as NOT_FOUND', () => {
            const error = GhClientError.fromError(new Error('HTTP 404 Not Found'), 'Test');
            expect(error.code).toBe('NOT_FOUND');
        });
        it('should classify 401/403 as AUTH_ERROR', () => {
            const error401 = GhClientError.fromError(new Error('HTTP 401 Unauthorized'), 'Test');
            expect(error401.code).toBe('AUTH_ERROR');
            const error403 = GhClientError.fromError(new Error('HTTP 403 Forbidden'), 'Test');
            expect(error403.code).toBe('AUTH_ERROR');
        });
        it('should classify rate limit errors as RATE_LIMIT', () => {
            const error = GhClientError.fromError(new Error('API rate limit exceeded'), 'Test');
            expect(error.code).toBe('RATE_LIMIT');
        });
        it('should classify 422 as VALIDATION_ERROR', () => {
            const error = GhClientError.fromError(new Error('HTTP 422 Unprocessable Entity'), 'Test');
            expect(error.code).toBe('VALIDATION_ERROR');
        });
        it('should classify 5xx as SERVER_ERROR', () => {
            const error502 = GhClientError.fromError(new Error('HTTP 502 Bad Gateway'), 'Test');
            expect(error502.code).toBe('SERVER_ERROR');
            const error503 = GhClientError.fromError(new Error('HTTP 503 Service Unavailable'), 'Test');
            expect(error503.code).toBe('SERVER_ERROR');
        });
        it('should classify network errors as NETWORK_ERROR', () => {
            const error = GhClientError.fromError(new Error('connect ETIMEDOUT'), 'Test');
            expect(error.code).toBe('NETWORK_ERROR');
        });
        it('should classify JSON parse errors as PARSE_ERROR', () => {
            const error = GhClientError.fromError(new Error('Unexpected token in JSON'), 'Test');
            expect(error.code).toBe('PARSE_ERROR');
        });
        it('should classify unknown errors as UNKNOWN', () => {
            const error = GhClientError.fromError(new Error('Something unexpected'), 'Test');
            expect(error.code).toBe('UNKNOWN');
        });
        it('should handle non-Error objects', () => {
            const error = GhClientError.fromError('string error', 'Test');
            expect(error.code).toBe('UNKNOWN');
            expect(error.message).toContain('string error');
        });
    });
});
describe('gh.issue', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('get', () => {
        it('should return issue data when found', async () => {
            const mockIssue = {
                number: 123,
                title: 'Test Issue',
                body: 'Issue body',
                state: 'OPEN',
                url: 'https://github.com/owner/repo/issues/123',
                labels: [{ name: 'bug', color: 'ff0000' }],
                author: { login: 'testuser', name: 'Test User' },
                assignees: [{ login: 'dev1' }],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
            };
            mockSafeExecGhJsonWithRetry.mockResolvedValue(mockIssue);
            const result = await gh.issue.get(123, 'owner/repo');
            expect(result).not.toBeNull();
            expect(result?.number).toBe(123);
            expect(result?.title).toBe('Test Issue');
            expect(result?.state).toBe('OPEN');
            expect(result?.labels).toHaveLength(1);
            expect(result?.labels[0].name).toBe('bug');
            expect(mockSafeExecGhJsonWithRetry).toHaveBeenCalledWith(expect.stringContaining('issue view 123'), expect.any(Object));
        });
        it('should return null when issue not found', async () => {
            mockSafeExecGhJsonWithRetry.mockResolvedValue(null);
            const result = await gh.issue.get(999, 'owner/repo');
            expect(result).toBeNull();
        });
    });
    describe('create', () => {
        it('should create an issue with required fields', async () => {
            const mockResponse = {
                number: 456,
                title: 'New Issue',
                body: 'Issue description',
                state: 'OPEN',
                url: 'https://github.com/owner/repo/issues/456',
            };
            mockExecGhJsonWithRetry.mockResolvedValue(mockResponse);
            const result = await gh.issue.create({
                title: 'New Issue',
                body: 'Issue description',
                repo: 'owner/repo',
            });
            expect(result.number).toBe(456);
            expect(result.title).toBe('New Issue');
            expect(mockExecGhJsonWithRetry).toHaveBeenCalledWith(expect.stringContaining('issue create'), expect.any(Object));
        });
        it('should include labels when provided', async () => {
            mockExecGhJsonWithRetry.mockResolvedValue({
                number: 789,
                title: 'Bug Report',
                body: '',
                state: 'OPEN',
                url: 'https://github.com/owner/repo/issues/789',
            });
            await gh.issue.create({
                title: 'Bug Report',
                labels: ['bug', 'priority:high'],
                repo: 'owner/repo',
            });
            expect(mockExecGhJsonWithRetry).toHaveBeenCalledWith(expect.stringContaining('--label "bug,priority:high"'), expect.any(Object));
        });
        it('should throw GhClientError on failure', async () => {
            mockExecGhJsonWithRetry.mockRejectedValue(new Error('Repository not found'));
            await expect(gh.issue.create({ title: 'Test', repo: 'owner/repo' })).rejects.toThrow(GhClientError);
        });
    });
    describe('update', () => {
        it('should update issue with provided fields', async () => {
            mockExecGhWithRetry.mockResolvedValue('');
            const result = await gh.issue.update(123, 'owner/repo', {
                title: 'Updated Title',
                addLabels: ['enhancement'],
            });
            expect(result).toBe(true);
            expect(mockExecGhWithRetry).toHaveBeenCalledWith(expect.stringMatching(/issue edit 123.*--title "Updated Title".*--add-label "enhancement"/), expect.any(Object));
        });
    });
    describe('addLabels', () => {
        it('should add labels to an issue', async () => {
            mockExecGhWithRetry.mockResolvedValue('');
            const result = await gh.issue.addLabels(123, 'owner/repo', ['bug', 'urgent']);
            expect(result).toBe(true);
            expect(mockExecGhWithRetry).toHaveBeenCalledWith(expect.stringContaining('--add-label "bug,urgent"'), expect.any(Object));
        });
    });
    describe('close', () => {
        it('should close an issue', async () => {
            mockExecGhWithRetry.mockResolvedValue('');
            const result = await gh.issue.close(123, 'owner/repo');
            expect(result).toBe(true);
            expect(mockExecGhWithRetry).toHaveBeenCalledWith(expect.stringContaining('issue close 123'), expect.any(Object));
        });
    });
    describe('exists', () => {
        it('should return true when issue exists', async () => {
            mockSafeExecGhJsonWithRetry.mockResolvedValue({
                number: 123,
                title: 'Test Issue',
                body: 'Issue body',
                state: 'OPEN',
                url: 'https://github.com/owner/repo/issues/123',
                labels: [],
            });
            const result = await gh.issue.exists(123, 'owner/repo');
            expect(result).toBe(true);
        });
        it('should return false when issue does not exist', async () => {
            mockSafeExecGhJsonWithRetry.mockResolvedValue(null);
            const result = await gh.issue.exists(999, 'owner/repo');
            expect(result).toBe(false);
        });
    });
    describe('list', () => {
        it('should list issues with filters', async () => {
            const mockIssues = [
                { number: 1, title: 'Issue 1', body: '', state: 'OPEN', url: '', labels: [] },
                { number: 2, title: 'Issue 2', body: '', state: 'OPEN', url: '', labels: [] },
            ];
            mockExecGhJsonWithRetry.mockResolvedValue(mockIssues);
            const result = await gh.issue.list('owner/repo', {
                state: 'open',
                labels: ['bug'],
                limit: 10,
            });
            expect(result).toHaveLength(2);
            expect(mockExecGhJsonWithRetry).toHaveBeenCalledWith(expect.stringMatching(/issue list.*--state open.*--label "bug".*--limit 10/), expect.any(Object));
        });
    });
});
describe('gh.pr', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('get', () => {
        it('should return PR data when found', async () => {
            const mockPR = {
                number: 42,
                title: 'Add feature',
                body: 'PR description',
                state: 'OPEN',
                url: 'https://github.com/owner/repo/pull/42',
                headRefName: 'feature-branch',
                baseRefName: 'main',
                isDraft: false,
                mergeable: 'MERGEABLE',
                author: { login: 'developer' },
                createdAt: '2024-01-01T00:00:00Z',
            };
            mockSafeExecGhJsonWithRetry.mockResolvedValue(mockPR);
            const result = await gh.pr.get(42, 'owner/repo');
            expect(result).not.toBeNull();
            expect(result?.number).toBe(42);
            expect(result?.headRefName).toBe('feature-branch');
            expect(result?.isDraft).toBe(false);
        });
        it('should return null when PR not found', async () => {
            mockSafeExecGhJsonWithRetry.mockResolvedValue(null);
            const result = await gh.pr.get(999, 'owner/repo');
            expect(result).toBeNull();
        });
    });
    describe('create', () => {
        it('should create a PR with required fields', async () => {
            const mockResponse = {
                number: 100,
                title: 'New Feature',
                body: 'PR body',
                state: 'OPEN',
                url: 'https://github.com/owner/repo/pull/100',
                headRefName: 'feature',
                baseRefName: 'main',
                isDraft: false,
            };
            mockExecGhJsonWithRetry.mockResolvedValue(mockResponse);
            const result = await gh.pr.create({
                title: 'New Feature',
                body: 'PR body',
                base: 'main',
                head: 'feature',
                repo: 'owner/repo',
            });
            expect(result.number).toBe(100);
            expect(mockExecGhJsonWithRetry).toHaveBeenCalledWith(expect.stringContaining('pr create'), expect.any(Object));
        });
        it('should create a draft PR when specified', async () => {
            mockExecGhJsonWithRetry.mockResolvedValue({
                number: 101,
                title: 'Draft PR',
                body: '',
                state: 'OPEN',
                url: '',
                headRefName: 'draft',
                baseRefName: 'main',
                isDraft: true,
            });
            await gh.pr.create({
                title: 'Draft PR',
                base: 'main',
                head: 'draft',
                draft: true,
                repo: 'owner/repo',
            });
            expect(mockExecGhJsonWithRetry).toHaveBeenCalledWith(expect.stringContaining('--draft'), expect.any(Object));
        });
    });
    describe('merge', () => {
        it('should merge a PR with default squash strategy', async () => {
            mockExecGhWithRetry.mockResolvedValue('');
            const result = await gh.pr.merge(42, 'owner/repo');
            expect(result).toBe(true);
            expect(mockExecGhWithRetry).toHaveBeenCalledWith(expect.stringMatching(/pr merge 42.*--squash.*--delete-branch/), expect.any(Object));
        });
        it('should use specified merge strategy', async () => {
            mockExecGhWithRetry.mockResolvedValue('');
            await gh.pr.merge(42, 'owner/repo', { strategy: 'rebase' });
            expect(mockExecGhWithRetry).toHaveBeenCalledWith(expect.stringContaining('--rebase'), expect.any(Object));
        });
        it('should not delete branch when specified', async () => {
            mockExecGhWithRetry.mockResolvedValue('');
            await gh.pr.merge(42, 'owner/repo', { deleteAfterMerge: false });
            expect(mockExecGhWithRetry).toHaveBeenCalledWith(expect.not.stringContaining('--delete-branch'), expect.any(Object));
        });
    });
    describe('close', () => {
        it('should close a PR without merging', async () => {
            mockExecGhWithRetry.mockResolvedValue('');
            const result = await gh.pr.close(42, 'owner/repo');
            expect(result).toBe(true);
            expect(mockExecGhWithRetry).toHaveBeenCalledWith(expect.stringContaining('pr close 42'), expect.any(Object));
        });
    });
    describe('list', () => {
        it('should list PRs with filters', async () => {
            const mockPRs = [
                { number: 1, title: 'PR 1', body: '', state: 'OPEN', url: '', headRefName: 'branch1', baseRefName: 'main', isDraft: false },
            ];
            mockExecGhJsonWithRetry.mockResolvedValue(mockPRs);
            const result = await gh.pr.list('owner/repo', { state: 'open', limit: 5 });
            expect(result).toHaveLength(1);
            expect(mockExecGhJsonWithRetry).toHaveBeenCalledWith(expect.stringMatching(/pr list.*--state open.*--limit 5/), expect.any(Object));
        });
    });
});
describe('gh.project', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('getItems', () => {
        it('should return all project items', async () => {
            const mockItems = {
                items: [
                    { id: 'item1', status: 'Ready', content: { type: 'Issue', number: 1, title: 'Issue 1' } },
                    { id: 'item2', status: 'In Progress', content: { type: 'Issue', number: 2, title: 'Issue 2' } },
                ],
            };
            mockExecGhJsonWithRetry.mockResolvedValue(mockItems);
            const result = await gh.project.getItems(7, 'owner');
            expect(result).toHaveLength(2);
            expect(result[0].status).toBe('Ready');
            expect(result[0].content?.number).toBe(1);
        });
        it('should filter items by status', async () => {
            const mockItems = {
                items: [
                    { id: 'item1', status: 'Ready', content: { type: 'Issue', number: 1, title: 'Issue 1' } },
                    { id: 'item2', status: 'In Progress', content: { type: 'Issue', number: 2, title: 'Issue 2' } },
                ],
            };
            mockExecGhJsonWithRetry.mockResolvedValue(mockItems);
            const result = await gh.project.getItems(7, 'owner', { status: 'Ready' });
            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('Ready');
        });
        it('should filter items by type', async () => {
            const mockItems = {
                items: [
                    { id: 'item1', status: 'Ready', content: { type: 'Issue', number: 1, title: 'Issue 1' } },
                    { id: 'item2', status: 'Ready', content: { type: 'PullRequest', number: 2, title: 'PR 2' } },
                ],
            };
            mockExecGhJsonWithRetry.mockResolvedValue(mockItems);
            const result = await gh.project.getItems(7, 'owner', { type: 'Issue' });
            expect(result).toHaveLength(1);
            expect(result[0].content?.type).toBe('Issue');
        });
    });
    describe('moveItem', () => {
        it('should move an item to a different column', async () => {
            mockExecGhWithRetry.mockResolvedValue('');
            const result = await gh.project.moveItem('project-id', 'item-id', 'field-id', 'option-id');
            expect(result).toBe(true);
            expect(mockExecGhWithRetry).toHaveBeenCalledWith(expect.stringMatching(/project item-edit.*--project-id "project-id".*--id "item-id".*--field-id "field-id".*--single-select-option-id "option-id"/), expect.any(Object));
        });
        it('should throw GhClientError on failure', async () => {
            mockExecGhWithRetry.mockRejectedValue(new Error('Project not found'));
            await expect(gh.project.moveItem('bad-id', 'item-id', 'field-id', 'option-id')).rejects.toThrow(GhClientError);
        });
    });
    describe('getFields', () => {
        it('should return project fields', async () => {
            const mockFields = {
                fields: [
                    { id: 'field1', name: 'Status', options: [{ id: 'opt1', name: 'Ready' }, { id: 'opt2', name: 'Done' }] },
                    { id: 'field2', name: 'Priority' },
                ],
            };
            mockExecGhJsonWithRetry.mockResolvedValue(mockFields);
            const result = await gh.project.getFields(7, 'owner');
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Status');
            expect(result[0].options).toHaveLength(2);
        });
    });
    describe('getStatusField', () => {
        it('should return the Status field', async () => {
            const mockFields = {
                fields: [
                    { id: 'field1', name: 'Status', options: [{ id: 'opt1', name: 'Ready' }] },
                    { id: 'field2', name: 'Priority' },
                ],
            };
            mockExecGhJsonWithRetry.mockResolvedValue(mockFields);
            const result = await gh.project.getStatusField(7, 'owner');
            expect(result).not.toBeNull();
            expect(result?.name).toBe('Status');
        });
        it('should return null when Status field not found', async () => {
            const mockFields = {
                fields: [
                    { id: 'field1', name: 'Priority' },
                ],
            };
            mockExecGhJsonWithRetry.mockResolvedValue(mockFields);
            const result = await gh.project.getStatusField(7, 'owner');
            expect(result).toBeNull();
        });
    });
    describe('list', () => {
        it('should list projects for an owner', async () => {
            const mockProjects = {
                projects: [
                    { id: 'proj1', number: 1, title: 'Project 1', url: 'https://github.com/...' },
                    { id: 'proj2', number: 2, title: 'Project 2' },
                ],
            };
            mockExecGhJsonWithRetry.mockResolvedValue(mockProjects);
            const result = await gh.project.list('owner');
            expect(result).toHaveLength(2);
            expect(result[0].title).toBe('Project 1');
        });
    });
    describe('addItem', () => {
        it('should add an issue to a project', async () => {
            mockExecGhWithRetry.mockResolvedValue('');
            const result = await gh.project.addItem(7, 'owner', 'https://github.com/owner/repo/issues/1');
            expect(result).toBe(true);
            expect(mockExecGhWithRetry).toHaveBeenCalledWith(expect.stringContaining('project item-add 7'), expect.any(Object));
        });
    });
});
describe('gh.api', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('getRateLimit', () => {
        it('should return rate limit information', async () => {
            const mockRateLimit = {
                resources: {
                    core: { limit: 5000, remaining: 4999, reset: Math.floor(Date.now() / 1000) + 3600, used: 1 },
                    graphql: { limit: 5000, remaining: 5000, reset: Math.floor(Date.now() / 1000) + 3600, used: 0 },
                },
            };
            mockExecGhJsonWithRetry.mockResolvedValue(mockRateLimit);
            const result = await gh.api.getRateLimit();
            expect(result.core.limit).toBe(5000);
            expect(result.core.remaining).toBe(4999);
            expect(result.core.reset).toBeInstanceOf(Date);
            expect(result.graphql.limit).toBe(5000);
        });
    });
    describe('call', () => {
        it('should make a raw API call', async () => {
            const mockResponse = { id: 123, name: 'test-repo' };
            mockExecGhJsonWithRetry.mockResolvedValue(mockResponse);
            const result = await gh.api.call('/repos/owner/repo');
            expect(result.id).toBe(123);
            expect(result.name).toBe('test-repo');
            expect(mockExecGhJsonWithRetry).toHaveBeenCalledWith(expect.stringContaining('api /repos/owner/repo'), expect.any(Object));
        });
        it('should throw GhClientError on failure', async () => {
            mockExecGhJsonWithRetry.mockRejectedValue(new Error('Not Found'));
            await expect(gh.api.call('/repos/nonexistent/repo')).rejects.toThrow(GhClientError);
        });
    });
});
//# sourceMappingURL=gh-client.test.js.map