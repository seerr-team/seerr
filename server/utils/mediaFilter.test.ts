import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getSettings } from '@server/lib/settings';
import { compileIgnoredPathPattern } from '@server/utils/ignoredPathPatterns';
import {
  getUnignoredJellyfinMediaSources,
  getUnignoredPlexMedia,
  isPathIgnored,
} from '@server/utils/mediaFilter';

describe('mediaFilter', () => {
  it('recompiles regexes for distinct pattern lists that collide under NUL-joined keys', () => {
    const settings = getSettings();
    const originalPatterns = [...(settings.main.ignoredPathPatterns ?? [])];
    const firstPatterns = ['^match$', 'x\0^other$'];
    const secondPatterns = ['^match$\0x', '^other$'];

    assert.equal(firstPatterns.join('\0'), secondPatterns.join('\0'));
    assert.notEqual(
      JSON.stringify(firstPatterns),
      JSON.stringify(secondPatterns)
    );

    try {
      settings.main.ignoredPathPatterns = firstPatterns;
      assert.equal(isPathIgnored(['match']), true);

      settings.main.ignoredPathPatterns = secondPatterns;
      assert.equal(isPathIgnored(['other']), true);
    } finally {
      settings.main.ignoredPathPatterns = originalPatterns;
    }
  });

  it('filters ignored Plex and Jellyfin sources without dropping mixed items', () => {
    const settings = getSettings();
    const originalPatterns = [...(settings.main.ignoredPathPatterns ?? [])];
    const plexMedia = [
      {
        Part: [{ file: '/library/movies/Test Movie (2024)/movie.mkv' }],
        videoResolution: '1080',
      },
      {
        Part: [{ file: '/library/movies/placeholders/Test Movie (2024).mkv' }],
        videoResolution: '4k',
      },
      {
        // Windows-style path: only matches "placeholders/" after backslash
        // normalization, so it must be filtered out.
        Part: [
          { file: 'C:\\library\\movies\\placeholders\\Test Movie (2024).mkv' },
        ],
        videoResolution: '4k',
      },
    ];
    const jellyfinSources = [
      {
        Path: '/library/shows/Test Show/Season 01/S01E01.mkv',
        MediaStreams: [],
      },
      {
        Path: '/library/shows/placeholders/Test Show/Season 01/S01E01.mkv',
        MediaStreams: [],
      },
      {
        // Windows-style path: only matches after backslash normalization.
        Path: 'C:\\library\\shows\\placeholders\\Test Show\\Season 01\\S01E01.mkv',
        MediaStreams: [],
      },
    ];

    try {
      settings.main.ignoredPathPatterns = ['placeholders/'];

      assert.equal(
        isPathIgnored([
          '/library/movies/Test Movie (2024)/movie.mkv',
          '/library/movies/placeholders/Test Movie (2024).mkv',
        ]),
        false
      );
      // Backslash normalization: Windows placeholder path is ignored, while a
      // Windows non-placeholder path is not.
      assert.equal(
        isPathIgnored([
          'C:\\library\\movies\\placeholders\\Test Movie (2024).mkv',
        ]),
        true
      );
      assert.equal(
        isPathIgnored(['C:\\library\\movies\\Test Movie (2024)\\movie.mkv']),
        false
      );
      assert.deepEqual(getUnignoredPlexMedia(plexMedia), [plexMedia[0]]);
      assert.deepEqual(getUnignoredJellyfinMediaSources(jellyfinSources), [
        jellyfinSources[0],
      ]);
    } finally {
      settings.main.ignoredPathPatterns = originalPatterns;
    }
  });

  it('skips unsafe ignored path patterns', () => {
    assert.equal(compileIgnoredPathPattern('(a+)+$'), null);
    assert.equal(compileIgnoredPathPattern('('), null);
    assert.equal(
      compileIgnoredPathPattern('placeholders/')?.test(
        '/library/placeholders/file.mkv'
      ),
      true
    );
  });
});
