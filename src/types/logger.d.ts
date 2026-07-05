export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'tutor';

export interface ColorTheme {
  bg?: string;
  fg?: string;
}

export interface LogTag {
  label: string;
  theme?: ColorTheme;
}

export interface LogLine {
  message: string;
  tags?: Array<LogTag>;
  textColor?: string;
  omitTimestamp?: boolean;
}

export interface LogHeader {
  title: string;
  level?: LogLevel;
  theme?: ColorTheme;
}

export interface LogPayload {
  level?: LogLevel;
  header?: LogHeader;
  lines: Array<LogLine>;
}

export type PaletteConfig = Record<LogLevel, Required<ColorTheme>>;
