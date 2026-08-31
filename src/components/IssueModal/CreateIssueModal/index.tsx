import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Modal from '@app/components/Common/Modal';
import { issueOptions } from '@app/components/IssueModal/constants';
import useSettings from '@app/hooks/useSettings';
import useToasts from '@app/hooks/useToasts';
import type { User } from '@app/hooks/useUser';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Listbox, RadioGroup, Transition } from '@headlessui/react';
import {
  ArrowRightCircleIcon,
  CheckIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/solid';
import { MediaStatus } from '@server/constants/media';
import type Issue from '@server/entity/Issue';
import type { UserResultsResponse } from '@server/interfaces/api/userInterfaces';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import axios from 'axios';
import { Field, Formik } from 'formik';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import useSWR, { mutate } from 'swr';
import * as Yup from 'yup';

const messages = defineMessages('components.IssueModal.CreateIssueModal', {
  validationMessageRequired: 'You must provide a description',
  whatswrong: "What's wrong?",
  providedetail:
    'Please provide a detailed explanation of the issue you encountered.',
  extras: 'Extras',
  season: 'Season {seasonNumber}',
  episode: 'Episode {episodeNumber}',
  allseasons: 'All Seasons',
  allepisodes: 'All Episodes',
  problemseason: 'Affected Season',
  problemepisode: 'Affected Episode',
  toastSuccessCreate:
    'Issue report for <strong>{title}</strong> submitted successfully!',
  toastFailedCreate: 'Something went wrong while submitting the issue.',
  toastviewissue: 'View Issue',
  reportissue: 'Report an Issue',
  submitissue: 'Submit Issue',
  reportas: 'Report As',
});

const isMovie = (movie: MovieDetails | TvDetails): movie is MovieDetails => {
  return (movie as MovieDetails).title !== undefined;
};

const classNames = (...classes: string[]) => {
  return classes.filter(Boolean).join(' ');
};

interface CreateIssueModalProps {
  mediaType: 'movie' | 'tv';
  tmdbId?: number;
  onCancel?: () => void;
}

const CreateIssueModal = ({
  onCancel,
  mediaType,
  tmdbId,
}: CreateIssueModalProps) => {
  const intl = useIntl();
  const settings = useSettings();
  const { user: currentUser, hasPermission } = useUser();
  const { addToast } = useToasts();
  const { data, error } = useSWR<MovieDetails | TvDetails>(
    tmdbId ? `/api/v1/${mediaType}/${tmdbId}` : null
  );
  const { data: userData } = useSWR<UserResultsResponse>(
    hasPermission(Permission.MANAGE_ISSUES)
      ? '/api/v1/user?take=1000&sort=displayname'
      : null
  );

  if (!tmdbId) {
    return null;
  }

  const availableSeasons = (data?.mediaInfo?.seasons ?? [])
    .filter(
      (season) =>
        season.status === MediaStatus.AVAILABLE ||
        season.status === MediaStatus.PARTIALLY_AVAILABLE ||
        (settings.currentSettings.series4kEnabled &&
          hasPermission([Permission.REQUEST_4K, Permission.REQUEST_4K_TV], {
            type: 'or',
          }) &&
          (season.status4k === MediaStatus.AVAILABLE ||
            season.status4k === MediaStatus.PARTIALLY_AVAILABLE))
    )
    .map((season) => season.seasonNumber);

  const CreateIssueModalSchema = Yup.object().shape({
    message: Yup.string().required(
      intl.formatMessage(messages.validationMessageRequired)
    ),
  });

  return (
    <Formik
      initialValues={{
        selectedIssue: issueOptions[0],
        message: '',
        problemSeason: availableSeasons.length === 1 ? availableSeasons[0] : 0,
        problemEpisode: 0,
        userId: currentUser?.id,
      }}
      validationSchema={CreateIssueModalSchema}
      onSubmit={async (values) => {
        try {
          const newIssue = await axios.post<Issue>('/api/v1/issue', {
            issueType: values.selectedIssue.issueType,
            message: values.message,
            mediaId: data?.mediaInfo?.id,
            problemSeason: values.problemSeason,
            problemEpisode:
              values.problemSeason > 0 ? values.problemEpisode : 0,
            ...(hasPermission(Permission.MANAGE_ISSUES) && values.userId
              ? { userId: values.userId }
              : {}),
          });

          if (data) {
            addToast(
              <>
                <div>
                  {intl.formatMessage(messages.toastSuccessCreate, {
                    title: isMovie(data) ? data.title : data.name,
                    strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
                  })}
                </div>
                <Link href={`/issues/${newIssue.data.id}`} legacyBehavior>
                  <Button as="a" className="mt-4">
                    <span>{intl.formatMessage(messages.toastviewissue)}</span>
                    <ArrowRightCircleIcon />
                  </Button>
                </Link>
              </>,
              {
                appearance: 'success',
                autoDismiss: true,
              }
            );

            mutate('/api/v1/issue/count');
          }

          if (onCancel) {
            onCancel();
          }
        } catch {
          addToast(intl.formatMessage(messages.toastFailedCreate), {
            appearance: 'error',
            autoDismiss: true,
          });
        }
      }}
    >
      {({ handleSubmit, values, setFieldValue, errors, touched }) => {
        const selectedUser: User | undefined =
          userData?.results.find((u) => u.id === values.userId) ?? currentUser;

        return (
          <Modal
            backgroundClickable
            onCancel={onCancel}
            title={intl.formatMessage(messages.reportissue)}
            subTitle={data && isMovie(data) ? data?.title : data?.name}
            cancelText={intl.formatMessage(globalMessages.close)}
            onOk={() => handleSubmit()}
            okText={intl.formatMessage(messages.submitissue)}
            loading={!data && !error}
            backdrop={`https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${data?.backdropPath}`}
          >
            {mediaType === 'tv' && data && !isMovie(data) && (
              <>
                <div className="form-row">
                  <label htmlFor="problemSeason" className="text-label">
                    {intl.formatMessage(messages.problemseason)}
                    <span className="label-required">*</span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="problemSeason"
                        name="problemSeason"
                        disabled={availableSeasons.length === 1}
                      >
                        {availableSeasons.length > 1 && (
                          <option value={0}>
                            {intl.formatMessage(messages.allseasons)}
                          </option>
                        )}
                        {availableSeasons.map((season) => (
                          <option
                            value={season}
                            key={`problem-season-${season}`}
                          >
                            {season === 0
                              ? intl.formatMessage(messages.extras)
                              : intl.formatMessage(messages.season, {
                                  seasonNumber: season,
                                })}
                          </option>
                        ))}
                      </Field>
                    </div>
                  </div>
                </div>
                {values.problemSeason > 0 && (
                  <div className="form-row mb-2">
                    <label htmlFor="problemEpisode" className="text-label">
                      {intl.formatMessage(messages.problemepisode)}
                      <span className="label-required">*</span>
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          as="select"
                          id="problemEpisode"
                          name="problemEpisode"
                        >
                          <option value={0}>
                            {intl.formatMessage(messages.allepisodes)}
                          </option>
                          {[
                            ...Array(
                              data.seasons.find(
                                (season) =>
                                  Number(values.problemSeason) ===
                                  season.seasonNumber
                              )?.episodeCount ?? 0
                            ),
                          ].map((i, index) => (
                            <option
                              value={index + 1}
                              key={`problem-episode-${index + 1}`}
                            >
                              {intl.formatMessage(messages.episode, {
                                episodeNumber: index + 1,
                              })}
                            </option>
                          ))}
                        </Field>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <RadioGroup
              value={values.selectedIssue}
              onChange={(issue) => setFieldValue('selectedIssue', issue)}
              className="mt-4"
            >
              <RadioGroup.Label className="sr-only">
                Select an Issue
              </RadioGroup.Label>
              <div className="-space-y-px overflow-hidden rounded-md bg-gray-800/30">
                {issueOptions.map((setting, index) => (
                  <RadioGroup.Option
                    key={`issue-type-${setting.issueType}`}
                    value={setting}
                    className={({ checked }) =>
                      classNames(
                        index === 0 ? 'rounded-tl-md rounded-tr-md' : '',
                        index === issueOptions.length - 1
                          ? 'rounded-bl-md rounded-br-md'
                          : '',
                        checked
                          ? 'z-10 border border-indigo-500 bg-indigo-400/20'
                          : 'border-gray-500',
                        'relative flex cursor-pointer border p-4 focus:outline-none'
                      )
                    }
                  >
                    {({ active, checked }) => (
                      <>
                        <span
                          className={`${
                            checked
                              ? 'border-transparent bg-indigo-600'
                              : 'border-gray-300 bg-white'
                          } ${
                            active ? 'ring-2 ring-indigo-300 ring-offset-2' : ''
                          } mt-0.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border`}
                          aria-hidden="true"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                        <div className="ml-3 flex flex-col">
                          <RadioGroup.Label
                            as="span"
                            className={`block text-sm font-medium ${
                              checked ? 'text-indigo-100' : 'text-gray-100'
                            }`}
                          >
                            {intl.formatMessage(setting.name)}
                          </RadioGroup.Label>
                        </div>
                      </>
                    )}
                  </RadioGroup.Option>
                ))}
              </div>
            </RadioGroup>
            <div className="mt-4 flex-col space-y-2">
              <label htmlFor="message">
                {intl.formatMessage(messages.whatswrong)}
                <span className="label-required">*</span>
              </label>
              <Field
                as="textarea"
                name="message"
                id="message"
                className="h-28"
                placeholder={intl.formatMessage(messages.providedetail)}
              />
              {errors.message &&
                touched.message &&
                typeof errors.message === 'string' && (
                  <div className="error">{errors.message}</div>
                )}
            </div>
            {hasPermission(Permission.MANAGE_ISSUES) &&
              selectedUser &&
              (userData?.results ?? []).length > 1 && (
                <div className="mt-4">
                  <Listbox
                    as="div"
                    value={selectedUser}
                    onChange={(value: User) =>
                      setFieldValue('userId', value.id)
                    }
                    className="space-y-1"
                  >
                    {({ open }) => (
                      <>
                        <Listbox.Label>
                          {intl.formatMessage(messages.reportas)}
                        </Listbox.Label>
                        <div className="relative">
                          <span className="inline-block w-full rounded-md shadow-sm">
                            <Listbox.Button className="focus:shadow-outline-blue relative w-full cursor-default rounded-md border border-gray-700 bg-gray-800 py-2 pl-3 pr-10 text-left text-white transition duration-150 ease-in-out focus:border-blue-300 focus:outline-none sm:text-sm sm:leading-5">
                              <span className="flex items-center">
                                <CachedImage
                                  type="avatar"
                                  src={selectedUser.avatar}
                                  alt=""
                                  className="h-6 w-6 flex-shrink-0 rounded-full object-cover"
                                  width={24}
                                  height={24}
                                />
                                <span className="ml-3 block">
                                  {selectedUser.displayName}
                                </span>
                                {selectedUser.displayName.toLowerCase() !==
                                  selectedUser.email && (
                                  <span className="ml-1 truncate text-gray-400">
                                    ({selectedUser.email})
                                  </span>
                                )}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500">
                                <ChevronDownIcon className="h-5 w-5" />
                              </span>
                            </Listbox.Button>
                          </span>

                          <Transition
                            show={open}
                            enter="transition-opacity ease-in duration-300"
                            enterFrom="opacity-0"
                            enterTo="opacity-100"
                            leave="transition-opacity ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 shadow-lg"
                          >
                            <Listbox.Options
                              static
                              className="shadow-xs max-h-60 overflow-auto rounded-md py-1 text-base leading-6 focus:outline-none sm:text-sm sm:leading-5"
                            >
                              {userData?.results.map((user) => (
                                <Listbox.Option key={user.id} value={user}>
                                  {({ selected, active }) => (
                                    <div
                                      className={`${
                                        active
                                          ? 'bg-indigo-600 text-white'
                                          : 'text-gray-300'
                                      } relative cursor-default select-none py-2 pl-8 pr-4`}
                                    >
                                      <span
                                        className={`${
                                          selected
                                            ? 'font-semibold'
                                            : 'font-normal'
                                        } flex items-center`}
                                      >
                                        <CachedImage
                                          type="avatar"
                                          src={user.avatar}
                                          alt=""
                                          className="h-6 w-6 flex-shrink-0 rounded-full object-cover"
                                          width={24}
                                          height={24}
                                        />
                                        <span className="ml-3 block flex-shrink-0">
                                          {user.displayName}
                                        </span>
                                        {user.displayName.toLowerCase() !==
                                          user.email && (
                                          <span className="ml-1 truncate text-gray-400">
                                            ({user.email})
                                          </span>
                                        )}
                                      </span>
                                      {selected && (
                                        <span
                                          className={`${
                                            active
                                              ? 'text-white'
                                              : 'text-indigo-600'
                                          } absolute inset-y-0 left-0 flex items-center pl-1.5`}
                                        >
                                          <CheckIcon className="h-5 w-5" />
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </>
                    )}
                  </Listbox>
                </div>
              )}
          </Modal>
        );
      }}
    </Formik>
  );
};

export default CreateIssueModal;
