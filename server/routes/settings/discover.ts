import { DiscoverSliderType } from '@server/constants/discover';
import { getRepository } from '@server/datasource';
import DiscoverSlider from '@server/entity/DiscoverSlider';
import {
  InvalidDiscoverNetworksError,
  sanitizeDiscoverNetworks,
} from '@server/lib/discoverNetworks';
import {
  InvalidDiscoverStudiosError,
  sanitizeDiscoverStudios,
} from '@server/lib/discoverStudios';
import logger from '@server/logger';
import { Router } from 'express';

// The built-in sliders that show a list the admin can change. Their data is a
// JSON list of brands that has to be validated before it is saved.
const brandListSanitizers: Partial<
  Record<DiscoverSliderType, (data: string | null) => string | null>
> = {
  [DiscoverSliderType.NETWORKS]: sanitizeDiscoverNetworks,
  [DiscoverSliderType.STUDIOS]: sanitizeDiscoverStudios,
};

// Returns the error code when the list is rejected, otherwise null
const applyBrandList = (
  existingSlider: DiscoverSlider,
  data: string | null | undefined
): string | null => {
  const sanitize = brandListSanitizers[existingSlider.type];

  if (!sanitize || data === undefined) {
    return null;
  }

  try {
    existingSlider.data = sanitize(data);
    return null;
  } catch (e) {
    if (
      e instanceof InvalidDiscoverNetworksError ||
      e instanceof InvalidDiscoverStudiosError
    ) {
      return e.message;
    }

    throw e;
  }
};

const discoverSettingRoutes = Router();

discoverSettingRoutes.post('/', async (req, res) => {
  const sliderRepository = getRepository(DiscoverSlider);

  const sliders = req.body as DiscoverSlider[];

  if (!Array.isArray(sliders)) {
    return res.status(400).json({ message: 'Invalid request body.' });
  }

  // Prepare all sliders and validate before saving any
  const prepared: DiscoverSlider[] = [];

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

      // Built-in sliders are fixed, except Networks and Studios, whose data is
      // the shared list.
      if (!existingSlider.isBuiltIn) {
        existingSlider.title = slider.title;
        existingSlider.data = slider.data;
        existingSlider.type = slider.type;
      } else {
        const brandListError = applyBrandList(existingSlider, slider.data);

        if (brandListError) {
          return res.status(400).json({ message: brandListError });
        }
      }

      prepared.push(existingSlider);
    } else {
      const newSlider = new DiscoverSlider({
        isBuiltIn: false,
        data: slider.data,
        title: slider.title,
        enabled: slider.enabled,
        order: x,
        type: slider.type,
      });
      prepared.push(newSlider);
    }
  }

  // All validation passed; now save everything together
  const savedSliders = await sliderRepository.save(prepared);

  return res.json(savedSliders);
});

discoverSettingRoutes.post('/add', async (req, res) => {
  const sliderRepository = getRepository(DiscoverSlider);

  const slider = req.body as DiscoverSlider;

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

  try {
    const existingSlider = await sliderRepository.findOneOrFail({
      where: {
        id: Number(req.params.sliderId),
      },
    });

    // Built-in sliders are fixed, except Networks and Studios, whose data is
    // the shared list.
    if (!existingSlider.isBuiltIn) {
      existingSlider.title = slider.title;
      existingSlider.data = slider.data;
      existingSlider.type = slider.type;
    } else {
      const brandListError = applyBrandList(existingSlider, slider.data);

      if (brandListError) {
        return res.status(400).json({ message: brandListError });
      }
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
