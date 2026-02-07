import { describe, it, expect } from 'vitest';
import { getInitials, truncate, stripMarkdown } from './utils';

describe('Utility Functions', () => {
    describe('getInitials', () => {
        it('should return ? for empty input', () => {
            expect(getInitials('')).toBe('?');
            expect(getInitials(null)).toBe('?');
        });

        it('should return single initial for single name', () => {
            expect(getInitials('John')).toBe('J');
        });

        it('should return first and last initials for full name', () => {
            expect(getInitials('John Doe')).toBe('JD');
        });

        it('should handle extra spaces', () => {
            expect(getInitials('  John   Doe  ')).toBe('JD');
        });
    });

    describe('truncate', () => {
        it('should return empty string for null/undefined', () => {
            expect(truncate(null)).toBe('');
            expect(truncate(undefined)).toBe('');
        });

        it('should return original text if shorter than maxLength', () => {
            expect(truncate('Hello', 10)).toBe('Hello');
        });

        it('should truncate text if longer than maxLength', () => {
            expect(truncate('Hello World', 5)).toBe('Hello...');
        });

        it('should use default maxLength of 50', () => {
            const longText = 'a'.repeat(60);
            expect(truncate(longText).length).toBe(53);
        });
    });

    describe('stripMarkdown', () => {
        it('should return empty string for empty input', () => {
            expect(stripMarkdown('')).toBe('');
        });

        it('should remove bold syntax', () => {
            expect(stripMarkdown('**Bold**')).toBe('Bold');
            expect(stripMarkdown('__Bold__')).toBe('Bold');
        });

        it('should remove italic syntax', () => {
            expect(stripMarkdown('*Italic*')).toBe('Italic');
            expect(stripMarkdown('_Italic_')).toBe('Italic');
        });

        it('should remove inline code syntax', () => {
            expect(stripMarkdown('`Code`')).toBe('Code');
        });

        it('should remove headers', () => {
            expect(stripMarkdown('# Header')).toBe('Header');
            expect(stripMarkdown('## Subheader')).toBe('Subheader');
        });

        it('should handle complex mixed markdown', () => {
            expect(stripMarkdown('**Bold** and *Italic* with `Code`')).toBe('Bold and Italic with Code');
        });
    });
});
