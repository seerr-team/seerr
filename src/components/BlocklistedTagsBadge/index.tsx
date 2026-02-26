import Badge from '@app/components/Common/Badge';
import Tooltip from '@app/components/Common/Tooltip';
import defineMessages from '@app/utils/defineMessages';
import { TagIcon } from '@heroicons/react/20/solid';
import type { BlocklistItem } from '@server/interfaces/api/blocklistInterfaces';
import type { Keyword } from '@server/models/common';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Settings', {
  blocklistedTagsText: 'Blocklisted Tags',
});

interface BlocklistedTagsBadgeProps {
  data: BlocklistItem;
}

const BlocklistedTagsBadge = ({ data }: BlocklistedTagsBadgeProps) => {
  const [tagNamesBlocklistedFor, setTagNamesBlocklistedFor] =
    useState<string>('Loading...');
  const intl = useIntl();

  useEffect(() => {
    if (!data.blocklistedTags) {
      return;
    }

    const keywordIds = data.blocklistedTags.slice(1, -1).split(',');
    Promise.all(
      keywordIds.map(async (keywordId) => {
        const { data } = await axios.get<Keyword | null>(
          `/api/v1/keyword/${keywordId}`
        );
        return data?.name || `[Invalid: ${keywordId}]`;
      })
    ).then((keywords) => {
      setTagNamesBlocklistedFor(keywords.join(', '));
    });
  }, [data.blocklistedTags]);

  return (
    <Tooltip
      content={tagNamesBlocklistedFor}
      tooltipConfig={{ followCursor: false }}
    >
      <Badge
        badgeType="dark"
        className="items-center border border-red-500 text-red-400!"
      >
        <TagIcon className="mr-1 h-4" />
        {intl.formatMessage(messages.blocklistedTagsText)}
      </Badge>
    </Tooltip>
  );
};

export default BlocklistedTagsBadge;
