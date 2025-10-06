import Button from '@app/components/Common/Button';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import type { TvDetails } from '@server/models/Tv';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';

const DEFAULT_EPISODE_THRESHOLD = 2;

const messages = defineMessages('components.ManageSlideOver.PrefetchForm', {
  prefetchEnable: 'Enable Prefetch',
  prefetchEnableTip: 'Automatically prefetches next season',
  prefetchEpisodeThreshold: 'Episode Threshold',
  prefetchEpisodeThresholdTip:
    'Prefetches if this count of episodes is left to watch',
  prefetchSave: 'Save Prefetch Settings',
  prefetchSettingsSaved: 'Prefetch Settings saved successfully!',
  prefetchSettingsFailed: 'Prefetch Settings failed to save.',
});

interface PrefetchFormProps {
  data: TvDetails;
  revalidate: () => void;
}

function PrefetchForm({ data, revalidate }: PrefetchFormProps) {
  const intl = useIntl();
  const { addToast } = useToasts();

  return (
    <Formik
      initialValues={{
        enabled: data.mediaInfo?.prefetchEnabled,
        episodeThreshold:
          data.mediaInfo?.prefetchEpisodeThreshold ?? DEFAULT_EPISODE_THRESHOLD,
      }}
      onSubmit={async (values) => {
        try {
          await axios.post(`/api/v1/media/${data.mediaInfo?.id}/prefetch`, {
            enabled: values.enabled,
            episodeThreshold: Number(values.episodeThreshold),
          });

          addToast(intl.formatMessage(messages.prefetchSettingsSaved), {
            appearance: 'success',
            autoDismiss: true,
          });
        } catch (e) {
          addToast(intl.formatMessage(messages.prefetchSettingsFailed), {
            appearance: 'error',
            autoDismiss: true,
          });
        } finally {
          revalidate();
        }
      }}
    >
      <Form>
        <div className="mb-2 overflow-hidden rounded-md border border-gray-700 shadow">
          <div className="flex min-w-full gap-4 border-b border-gray-700 px-4 py-3">
            <label htmlFor="enabled" className="grow">
              <span>{intl.formatMessage(messages.prefetchEnable)}</span>
              <span className="label-tip">
                {intl.formatMessage(messages.prefetchEnableTip)}
              </span>
            </label>
            <Field type="checkbox" id="enabled" name="enabled" />
          </div>
          <div className="flex min-w-full gap-4 px-4 py-3">
            <label htmlFor="episodeThreshold" className="grow basis-2/3">
              <span>
                {intl.formatMessage(messages.prefetchEpisodeThreshold)}
              </span>
              <span className="label-tip">
                {intl.formatMessage(messages.prefetchEpisodeThresholdTip)}
              </span>
            </label>
            <Field as="select" id="episodeThreshold" name="episodeThreshold">
              {[...Array(10)].map((_item, i) => (
                <option value={i + 1} key={`prefetch-threshold-${i + 1}`}>
                  {i + 1}
                </option>
              ))}
            </Field>
          </div>
        </div>

        <Button type="submit" buttonType="primary" className="w-full">
          <ArrowDownOnSquareIcon />
          <span>{intl.formatMessage(messages.prefetchSave)}</span>
        </Button>
      </Form>
    </Formik>
  );
}

export default PrefetchForm;
