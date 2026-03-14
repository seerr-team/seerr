import { ThemeContext } from '@app/context/ThemeContext';
import { useContext } from 'react';

const useTheme = () => useContext(ThemeContext);

export default useTheme;
