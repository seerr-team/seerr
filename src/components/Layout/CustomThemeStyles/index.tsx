import useSWR from 'swr';

const fetchCss = (url: string): Promise<string> =>
  fetch(url).then((res) => (res.ok ? res.text() : ''));

const CustomThemeStyles = () => {
  const { data: customCss } = useSWR('/api/v1/custom.css', fetchCss, {
    revalidateOnFocus: false,
  });

  const css = customCss?.trim();
  if (!css) {
    return null;
  }

  return <style id="seerr-custom-theme">{css}</style>;
};

export default CustomThemeStyles;
