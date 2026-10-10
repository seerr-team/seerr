import {
  DiscoverSliderType,
  TMDB_LIST_ID_REGEX,
} from '@server/constants/discover';
import { getRepository } from '@server/datasource';
import DiscoverSlider from '@server/entity/DiscoverSlider';
import logger from '@server/logger';
import { Router } from 'express';

const discoverSettingRoutes = Router();

const hasValidData = (slider: Partial<DiscoverSlider>): boolean =>
  Number(slider.type) !== DiscoverSliderType.TMDB_LIST ||
  (typeof slider.data === 'string' && TMDB_LIST_ID_REGEX.test(slider.data));

discoverSettingRoutes.post('/', async (req, res) => {
  const sliderRepository = getRepository(DiscoverSlider);

  const sliders = req.body as DiscoverSlider[];

  if (!Array.isArray(sliders)) {
    return res.status(400).json({ message: 'Invalid request body.' });
  }

  if (sliders.some((slider) => !hasValidData(slider))) {
    return res.status(400).json({ message: 'Invalid TMDB list ID.' });
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

  if (!hasValidData(slider)) {
    return res.status(400).json({ message: 'Invalid TMDB list ID.' });
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

  if (!hasValidData(slider)) {
    return res.status(400).json({ message: 'Invalid TMDB list ID.' });
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
