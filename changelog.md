# Changelog

**English** · [Русский](changelog.ru.md)

## 1.6.0 — 2026-10-31

- Added English and Russian interfaces, with English as the default.
- Language switching preserves email content, the block library and undo history.
- Added bilingual documentation with English as the primary version.

## 1.5.1 — 2026-10-31

- Renamed the project to inkvelope.
- Replaced email and sample cover styling with an independent gray-and-blue palette.
- Replaced the previous brand font set with standard fonts; Arial, Helvetica, sans-serif is the default.
- Removed brand-specific font name aliases during import; custom families and fallback lists are preserved.
- Updated samples, tests and documentation for general use.
- Added the MIT license, including a copy inside the standalone HTML file.

## 1.5.0 — 2026-09-30

- Open About on startup, with Getting started first and technical details below.
- Keep How to send focused on Outlook delivery, separate from export controls.

## 1.4.0 — 2026-09-30

The header follows the editing workflow: import, undo and redo, export, then help.

- Moved Import and How to send from editor tabs to the header, highlighting the active pane.
- Replaced Undo and Redo with round arrow buttons and tooltips.
- Moved theme switching to a sun/moon button in the header.
- Made Appearance the first editor tab.

## 1.3.0 — 2026-09-30

- Added compatibility between old and new brand font family names during import. This special handling was removed in 1.5.1.

## 1.2.0 — 2026-09-30

- Updated the default font and suggestions for the previous brand font set, replaced by standard fonts in 1.5.1.

## 1.1.0 — 2026-09-30

- Added per-block fonts for Text and Heading blocks.
- Added centered heading alignment.
- Added checks for missing block fonts and fallback lists.
- Preserved per-block fonts and alignment during import.

## 1.0.0 — 2026-09-30

First numbered release, including all previously developed features:

- Block-based email editing, live preview and click-to-edit controls.
- Columns, block backgrounds, buttons, preheaders, saved blocks and templates.
- Undo and redo, drag and drop, and number steppers.
- Import from `.msg`, `.oft`, `.eml`, `.mht`, `.html`, `.olk15Message` and the clipboard.
- Checks for links, images, fonts and Outlook compatibility.
- A separate font for email headings.
- Rich-text and HTML copy, HTML downloads and JSON project files.
