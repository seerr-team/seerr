import { DiscoverSliderType } from '@server/constants/discover';
import { getRepository } from '@server/datasource';
import DiscoverSlider from '@server/entity/DiscoverSlider';
import { getMediaListProvider } from '@server/lib/medialists';
import logger from '@server/logger';
import { Router } from 'express';

const discoverSettingRoutes = Router();

/**
 * Validates the free-form `data` field of a slider. Returns an error message
 * when the value is not usable, otherwise `null`.
 *
 * List sliders are the only type whose data is used to build an outbound
 * request path, so it must be a well-formed provider list id and nothing else.
 */
export const validateSliderData = (
  slider: Pick<DiscoverSlider, 'type' | 'data'>
): string | null => {
  if (Number(slider.type) !== DiscoverSliderType.TMDB_LIST) {
    return null;
  }

  const provider = getMediaListProvider('tmdb');

  if (!slider.data || !provider?.validateListId(slider.data)) {
    return 'Invalid TMDB list ID. Provide the numeric ID of a public TMDB list.';
  }

  return null;
};

discoverSettingRoutes.post('/', async (req, res) => {
  const sliderRepository = getRepository(DiscoverSlider);

  const sliders = req.body as DiscoverSlider[];

  if (!Array.isArray(sliders)) {
    return res.status(400).json({ message: 'Invalid request body.' });
  }

  for (const slider of sliders) {
    const validationError = validateSliderData(slider);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
  }

  for (let x = 0; x < sliders.length; x++) {
    const slider = sliders[x];
    const existingSlider = await sliderRepository.findOne({
      where: {
        id: slider.id,
      },
    });

    if (existingSlider && slider.id) {
      existingSlider.enabled = slider.enabled;
      existingSlider.order = x;

      // Only allow changes to the following when the slider is not built in
      if (!existingSlider.isBuiltIn) {
        existingSlider.title = slider.title;
        existingSlider.data = slider.data;
        existingSlider.type = slider.type;
      }

      await sliderRepository.save(existingSlider);
    } else {
      const newSlider = new DiscoverSlider({
        isBuiltIn: false,
        data: slider.data,
        title: slider.title,
        enabled: slider.enabled,
        order: x,
        type: slider.type,
      });
      await sliderRepository.save(newSlider);
    }
  }

  return res.json(sliders);
});

discoverSettingRoutes.post('/add', async (req, res) => {
  const sliderRepository = getRepository(DiscoverSlider);

  const slider = req.body as DiscoverSlider;

  const validationError = validateSliderData(slider);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const newSlider = new DiscoverSlider({
    isBuiltIn: false,
    data: slider.data,
    title: slider.title,
    enabled: false,
    order: -1,
    type: slider.type,
  });
  await sliderRepository.save(newSlider);

  return res.json(newSlider);
});

discoverSettingRoutes.get('/reset', async (_req, res) => {
  const sliderRepository = getRepository(DiscoverSlider);

  await sliderRepository.clear();
  await DiscoverSlider.bootstrapSliders();

  return res.status(204).send();
});

discoverSettingRoutes.put('/:sliderId', async (req, res, next) => {
  const sliderRepository = getRepository(DiscoverSlider);

  const slider = req.body as DiscoverSlider;

  const validationError = validateSliderData(slider);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const existingSlider = await sliderRepository.findOneOrFail({
      where: {
        id: Number(req.params.sliderId),
      },
    });

    // Only allow changes to the following when the slider is not built in
    if (!existingSlider.isBuiltIn) {
      existingSlider.title = slider.title;
      existingSlider.data = slider.data;
      existingSlider.type = slider.type;
    }

    await sliderRepository.save(existingSlider);

    return res.status(200).json(existingSlider);
  } catch (e) {
    logger.error('Something went wrong updating a slider.', {
      label: 'API',
      errorMessage: e.message,
    });
    next({ status: 404, message: 'Slider not found or cannot be updated.' });
  }
});

discoverSettingRoutes.delete('/:sliderId', async (req, res, next) => {
  const sliderRepository = getRepository(DiscoverSlider);

  try {
    const slider = await sliderRepository.findOneOrFail({
      where: { id: Number(req.params.sliderId), isBuiltIn: false },
    });

    await sliderRepository.remove(slider);

    return res.status(204).send();
  } catch (e) {
    logger.error('Something went wrong deleting a slider.', {
      label: 'API',
      errorMessage: e.message,
    });
    next({ status: 404, message: 'Slider not found or cannot be deleted.' });
  }
});

export default discoverSettingRoutes;
