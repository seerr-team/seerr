import Modal from '@app/components/Common/Modal';
import Tooltip from '@app/components/Common/Tooltip';
import CopyButton from '@app/components/Settings/CopyButton';
import { encodeURIExtraParams } from '@app/hooks/useDiscover';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { ArrowDownIcon } from '@heroicons/react/24/solid';
import type {
  TmdbKeyword,
  TmdbKeywordSearchResponse,
} from '@server/api/themoviedb/interfaces';
import type { Keyword } from '@server/models/common';
import axios from 'axios';
import { useFormikContext } from 'formik';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useIntl } from 'react-intl';
import type { ClearIndicatorProps, GroupBase, MultiValue } from 'react-select';
import { components } from 'react-select';
import AsyncSelect from 'react-select/async';

const messages = defineMessages('components.Settings', {
  copyBlacklistedTags: 'Copied blacklisted tags to clipboard.',
  copyBlacklistedTagsTip: 'Copy blacklisted tag configuration',
  copyBlacklistedTagsEmpty: 'Nothing to copy',
  importBlacklistedTagsTip: 'Import blacklisted tag configuration',
  clearBlacklistedTagsConfirm:
    'Are you sure you want to clear the blacklisted tags?',
  yes: 'Yes',
  no: 'No',
  searchKeywords: 'Search keywords…',
  starttyping: 'Starting typing to search.',
  nooptions: 'No results.',
  blacklistedTagImportTitle: 'Import Blacklisted Tag Configuration',
  blacklistedTagImportInstructions: 'Paste blacklist tag configuration below.',
  valueRequired: 'You must provide a value.',
  noSpecialCharacters:
    'Configuration must be a comma delimited list of TMDB keyword ids, and must not start or end with a comma.',
  invalidKeyword: '{keywordId} is not a TMDB keyword.',
});

type SingleVal = {
  label: string;
  value: number;
};

type BlacklistedTagsSelectorProps = {
  defaultValue?: string;
};

const BlacklistedTagsSelector = ({
  defaultValue,
}: BlacklistedTagsSelectorProps) => {
  const { setFieldValue } = useFormikContext();
  const [value, setValue] = useState<string | undefined>(defaultValue);
  const intl = useIntl();
  const [selectorValue, setSelectorValue] =
    useState<MultiValue<SingleVal> | null>(null);

  const update = useCallback(
    (value: MultiValue<SingleVal> | null) => {
      const strVal = value?.map((v) => v.value).join(',');
      setSelectorValue(value);
      setValue(strVal);
      setFieldValue('blacklistedTags', strVal);
    },
    [setSelectorValue, setValue, setFieldValue]
  );

  const copyDisabled = value === null || value?.length === 0;

  return (
    <>
      <ControlledKeywordSelector
        value={selectorValue}
        onChange={update}
        defaultValue={defaultValue}
        components={{
          DropdownIndicator: undefined,
          IndicatorSeparator: undefined,
          ClearIndicator: VerifyClearIndicator,
        }}
      />

      <CopyButton
        textToCopy={value ?? ''}
        disabled={copyDisabled}
        toastMessage={intl.formatMessage(messages.copyBlacklistedTags)}
        tooltipContent={intl.formatMessage(
          copyDisabled
            ? messages.copyBlacklistedTagsEmpty
            : messages.copyBlacklistedTagsTip
        )}
        tooltipConfig={{ followCursor: false }}
      />
      <BlacklistedTagsImportButton setSelector={update} />
    </>
  );
};

type BaseSelectorMultiProps = {
  defaultValue?: string;
  value: MultiValue<SingleVal> | null;
  onChange: (value: MultiValue<SingleVal> | null) => void;
  components?: Partial<typeof components>;
};

const ControlledKeywordSelector = ({
  defaultValue,
  onChange,
  components,
  value,
}: BaseSelectorMultiProps) => {
  const intl = useIntl();

  useEffect(() => {
    const loadDefaultKeywords = async (): Promise<void> => {
      if (!defaultValue) {
        return;
      }

      const keywords = await Promise.all(
        defaultValue.split(',').map(async (keywordId) => {
          const { data } = await axios.get<Keyword | null>(
            `/api/v1/keyword/${keywordId}`
          );
          return data;
        })
      );

      const validKeywords: TmdbKeyword[] = keywords.filter(
        (keyword): keyword is TmdbKeyword => keyword !== null
      );

      onChange(
        validKeywords.map((keyword) => ({
          label: keyword.name,
          value: keyword.id,
        }))
      );
    };

    loadDefaultKeywords();
  }, [defaultValue, onChange]);

  const loadKeywordOptions = async (inputValue: string) => {
    const { data } = await axios.get<TmdbKeywordSearchResponse>(
      `/api/v1/search/keyword?query=${encodeURIExtraParams(inputValue)}`
    );

    return data.results.map((result) => ({
      label: result.name,
      value: result.id,
    }));
  };

  return (
    <AsyncSelect
      key={`keyword-select-blacklistedTags`}
      inputId="data"
      isMulti
      className="react-select-container"
      classNamePrefix="react-select"
      noOptionsMessage={({ inputValue }) =>
        inputValue === ''
          ? intl.formatMessage(messages.starttyping)
          : intl.formatMessage(messages.nooptions)
      }
      value={value}
      loadOptions={loadKeywordOptions}
      placeholder={intl.formatMessage(messages.searchKeywords)}
      onChange={onChange}
      components={components}
    />
  );
};

type BlacklistedTagsImportButtonProps = {
  setSelector: (value: MultiValue<SingleVal>) => void;
};

const BlacklistedTagsImportButton = ({
  setSelector,
}: BlacklistedTagsImportButtonProps) => {
  const [show, setShow] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const intl = useIntl();

  const onConfirm = useCallback(async () => {
    if (formRef.current) {
      if (await formRef.current.submitForm()) {
        setShow(false);
      }
    }
  }, []);

  const onClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setShow(true);
  }, []);

  return (
    <>
      <Transition
        as="div"
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={show}
      >
        <Modal
          title={intl.formatMessage(messages.blacklistedTagImportTitle)}
          okText="Confirm"
          onOk={onConfirm}
          onCancel={() => setShow(false)}
        >
          <BlacklistedTagImportForm ref={formRef} setSelector={setSelector} />
        </Modal>
      </Transition>

      <Tooltip
        content={intl.formatMessage(messages.importBlacklistedTagsTip)}
        tooltipConfig={{ followCursor: false }}
      >
        <button className="input-action" onClick={onClick} type="button">
          <ArrowDownIcon />
        </button>
      </Tooltip>
    </>
  );
};

type BlacklistedTagImportFormProps = BlacklistedTagsImportButtonProps;

const BlacklistedTagImportForm = forwardRef<
  Partial<HTMLFormElement>,
  BlacklistedTagImportFormProps
>((props, ref) => {
  const { setSelector } = props;
  const intl = useIntl();
  const [formValue, setFormValue] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  useImperativeHandle(ref, () => ({
    submitForm: handleSubmit,
    formValue,
  }));

  const validate = async () => {
    if (formValue.length === 0) {
      setErrors([intl.formatMessage(messages.valueRequired)]);
      return false;
    }

    if (!/^(?:\d+,)*\d+$/.test(formValue)) {
      setErrors([intl.formatMessage(messages.noSpecialCharacters)]);
      return false;
    }

    const keywords = await Promise.allSettled(
      formValue.split(',').map(async (keywordId) => {
        try {
          const { data } = await axios.get<Keyword>(
            `/api/v1/keyword/${keywordId}`
          );
          return {
            label: data.name,
            value: data.id,
          };
        } catch (err) {
          throw intl.formatMessage(messages.invalidKeyword, { keywordId });
        }
      })
    );

    const failures = keywords.filter(
      (res) => res.status === 'rejected'
    ) as PromiseRejectedResult[];
    if (failures.length > 0) {
      setErrors(failures.map((failure) => `${failure.reason}`));
      return false;
    }

    setSelector(
      (keywords as PromiseFulfilledResult<SingleVal>[]).map(
        (keyword) => keyword.value
      )
    );

    setErrors([]);
    return true;
  };

  const handleSubmit = validate;

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="value">
          {intl.formatMessage(messages.blacklistedTagImportInstructions)}
        </label>
        <textarea
          id="value"
          value={formValue}
          onChange={(e) => setFormValue(e.target.value)}
          className="h-20"
        />
        {errors.length > 0 && (
          <div className="error">
            {errors.map((error) => (
              <div key={error}>{error}</div>
            ))}
          </div>
        )}
      </div>
    </form>
  );
});

const VerifyClearIndicator = <
  Option,
  IsMuti extends boolean,
  Group extends GroupBase<Option>
>(
  props: ClearIndicatorProps<Option, IsMuti, Group>
) => {
  const { clearValue } = props;
  const [show, setShow] = useState(false);
  const intl = useIntl();

  const openForm = useCallback(() => {
    setShow(true);
  }, [setShow]);

  const openFormKey = useCallback(
    (event: React.KeyboardEvent) => {
      if (show) return;

      if (event.key === 'Enter' || event.key === 'Space') {
        setShow(true);
      }
    },
    [setShow, show]
  );

  const acceptForm = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.stopPropagation();
        event.preventDefault();
        clearValue();
      }
    },
    [clearValue]
  );

  useEffect(() => {
    if (show) {
      window.addEventListener('keydown', acceptForm);
    }

    return () => window.removeEventListener('keydown', acceptForm);
  }, [show, acceptForm]);

  return (
    <>
      <button
        type="button"
        onClick={openForm}
        onKeyDown={openFormKey}
        className="react-select__indicator react-select__clear-indicator css-1xc3v61-indicatorContainer cursor-pointer"
      >
        <components.CrossIcon />
      </button>
      <Transition
        as="div"
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={show}
      >
        <Modal
          subTitle={intl.formatMessage(messages.clearBlacklistedTagsConfirm)}
          okText={intl.formatMessage(messages.yes)}
          cancelText={intl.formatMessage(messages.no)}
          onOk={clearValue}
          onCancel={() => setShow(false)}
        >
          <form />{' '}
          {/* Form prevents accidentally saving settings when pressing enter */}
        </Modal>
      </Transition>
    </>
  );
};

export default BlacklistedTagsSelector;
