import { MediaType } from '@server/constants/media';
import axios from 'axios';

export type FeedbackType = 'like' | 'dislike' | 'seen';

const useAiFeedback = () => {
  const submit = async (
    tmdbId: number,
    mediaType: MediaType,
    feedbackType: FeedbackType
  ): Promise<void> => {
    await axios.post('/api/v1/ai/feedback', {
      tmdbId,
      mediaType: mediaType === MediaType.TV ? 'tv' : 'movie',
      feedbackType,
    });
  };

  const remove = async (
    tmdbId: number,
    mediaType: MediaType
  ): Promise<void> => {
    await axios.delete(
      `/api/v1/ai/feedback/${tmdbId}?mediaType=${
        mediaType === MediaType.TV ? 'tv' : 'movie'
      }`
    );
  };

  return { submit, remove };
};

export default useAiFeedback;
