import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import {
  getMovieRatingOptions,
  getTvRatingOptions,
} from '@server/constants/contentRatings';
import type { UserSettingsParentalControlsResponse } from '@server/interfaces/api/userSettingsInterfaces';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserParentalControlsSettings',
  {
    parentalcontrols: 'Parental Controls',
    parentalcontrolssettings: 'Content Rating Limits',
    parentalcontrolsdescription:
      'Set maximum content ratings for this user. Content above these ratings will be hidden from discover and search results.',
    maxmovierating: 'Max Movie Rating',
    maxmovieratingTip:
      'Movies above this rating will be hidden from this user (MPAA ratings)',
    maxtvrating: 'Max TV Rating',
    maxtvratingTip:
      'TV shows above this rating will be hidden from this user (TV Parental Guidelines)',
    blockunrated: 'Block Unrated Content',
    blockunratedTip:
      'Block content that has no rating (NR, Unrated). When disabled, unrated content is allowed through.',
    blockadult: 'Block Adult Content',
    blockadultTip:
      'Block content flagged as adult by TMDB. This is separate from content ratings and covers explicit/pornographic content.',
    toastSettingsSuccess: 'Parental control settings saved successfully!',
    toastSettingsFailure: 'Something went wrong while saving settings.',
  }
);

const UserParentalControlsSettings = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const router = useRouter();
  const { user } = useUser({
    id: Number(router.query.userId),
  });
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<UserSettingsParentalControlsResponse>(
    user ? `/api/v1/user/${user?.id}/settings/parental-controls` : null
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <ErrorPage statusCode={500} />;
  }

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.parentalcontrols),
          intl.formatMessage(globalMessages.usersettings),
        ]}
      />
      <div className="mb-6">
        <h3 className="heading">
          {intl.formatMessage(messages.parentalcontrolssettings)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.parentalcontrolsdescription)}
        </p>
      </div>
      <Formik
        initialValues={{
          maxMovieRating: data?.maxMovieRating ?? 'NC-17',
          maxTvRating: data?.maxTvRating ?? 'TV-MA',
          blockUnrated: data?.blockUnrated ?? false,
          blockAdult: data?.blockAdult ?? false,
        }}
        enableReinitialize
        onSubmit={async (values) => {
          try {
            await axios.post(
              `/api/v1/user/${user?.id}/settings/parental-controls`,
              {
                maxMovieRating: values.maxMovieRating,
                maxTvRating: values.maxTvRating,
                blockUnrated: values.blockUnrated,
                blockAdult: values.blockAdult,
              }
            );

            addToast(intl.formatMessage(messages.toastSettingsSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            addToast(intl.formatMessage(messages.toastSettingsFailure), {
              autoDismiss: true,
              appearance: 'error',
            });
          } finally {
            revalidate();
          }
        }}
      >
        {({ isSubmitting, isValid }) => {
          return (
            <Form className="section">
              <div className="form-row">
                <label htmlFor="maxMovieRating" className="text-label">
                  <span>{intl.formatMessage(messages.maxmovierating)}</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.maxmovieratingTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      as="select"
                      id="maxMovieRating"
                      name="maxMovieRating"
                    >
                      {getMovieRatingOptions().map((rating) => (
                        <option key={rating.value} value={rating.value}>
                          {rating.label}
                        </option>
                      ))}
                    </Field>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="maxTvRating" className="text-label">
                  <span>{intl.formatMessage(messages.maxtvrating)}</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.maxtvratingTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field as="select" id="maxTvRating" name="maxTvRating">
                      {getTvRatingOptions().map((rating) => (
                        <option key={rating.value} value={rating.value}>
                          {rating.label}
                        </option>
                      ))}
                    </Field>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="blockUnrated" className="checkbox-label">
                  <span>{intl.formatMessage(messages.blockunrated)}</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.blockunratedTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="blockUnrated"
                    name="blockUnrated"
                    className="rounded-md"
                  />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="blockAdult" className="checkbox-label">
                  <span>{intl.formatMessage(messages.blockadult)}</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.blockadultTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="blockAdult"
                    name="blockAdult"
                    className="rounded-md"
                  />
                </div>
              </div>
              <div className="actions">
                <div className="flex justify-end">
                  <span className="ml-3 inline-flex rounded-md shadow-sm">
                    <Button
                      buttonType="primary"
                      type="submit"
                      disabled={isSubmitting || !isValid}
                    >
                      <ArrowDownOnSquareIcon />
                      <span>
                        {isSubmitting
                          ? intl.formatMessage(globalMessages.saving)
                          : intl.formatMessage(globalMessages.save)}
                      </span>
                    </Button>
                  </span>
                </div>
              </div>
            </Form>
          );
        }}
      </Formik>
    </>
  );
};

export default UserParentalControlsSettings;
