import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import useToasts from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
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
import useSWR from 'swr';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserParentalControlsSettings',
  {
    parentalcontrols: 'Parental Controls',
    parentalcontrolssettings: 'Content Rating Limits',
    parentalcontrolsdescription:
      'Set maximum content ratings and rating restrictions for this user. Limits use the US rating systems: MPAA for movies and TV Parental Guidelines for TV shows.',
    maxmovierating: 'Max Movie Rating',
    maxmovieratingTip:
      'Movies above this rating will be hidden from this user (US MPAA ratings)',
    maxtvrating: 'Max TV Rating',
    maxtvratingTip:
      'TV shows above this rating will be hidden from this user (US TV Parental Guidelines)',
    maxtvratingUnratedWarning:
      'Setting a TV rating limit hides shows that have no US TV rating. Most popular shows are rated; much of the wider catalog is not.',
    norestriction: 'No Restriction',
    blockunrated: 'Block Unrated Content',
    blockunratedTip:
      'Block content that has no rating (NR, Unrated). When disabled, unrated content is allowed through.',
    toastSettingsSuccess: 'Parental control settings saved successfully!',
    toastSettingsFailure: 'Something went wrong while saving settings.',
    unauthorizedDescription:
      'You do not have permission to modify parental controls for this user.',
  }
);

const UserParentalControlsSettings = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const router = useRouter();
  const { user, hasPermission } = useUser({
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

  if (user?.id === 1 || hasPermission(Permission.MANAGE_USERS)) {
    return (
      <>
        <div className="mb-6">
          <h3 className="heading">
            {intl.formatMessage(messages.parentalcontrols)}
          </h3>
        </div>
        <Alert
          title={intl.formatMessage(messages.unauthorizedDescription)}
          type="error"
        />
      </>
    );
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
          maxMovieRating: data?.maxMovieRating ?? '',
          maxTvRating: data?.maxTvRating ?? '',
          blockUnrated: data?.blockUnrated ?? false,
        }}
        enableReinitialize
        onSubmit={async (values) => {
          try {
            await axios.post(
              `/api/v1/user/${user?.id}/settings/parental-controls`,
              {
                maxMovieRating: values.maxMovieRating || undefined,
                maxTvRating: values.maxTvRating || undefined,
                blockUnrated: values.blockUnrated,
              }
            );

            addToast(intl.formatMessage(messages.toastSettingsSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            addToast(
              e?.response?.data?.message ??
                intl.formatMessage(messages.toastSettingsFailure),
              {
                autoDismiss: true,
                appearance: 'error',
              }
            );
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
                      <option value="">
                        {intl.formatMessage(messages.norestriction)}
                      </option>
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
                      <option value="">
                        {intl.formatMessage(messages.norestriction)}
                      </option>
                      {getTvRatingOptions().map((rating) => (
                        <option key={rating.value} value={rating.value}>
                          {rating.label}
                        </option>
                      ))}
                    </Field>
                  </div>
                  <div className="mt-2 text-sm text-gray-400">
                    {intl.formatMessage(messages.maxtvratingUnratedWarning)}
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
