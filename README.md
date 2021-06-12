# reduxjs-toolkit-monitored-slice

Allow easy creation of a monitored slice that's compatible with @reduxjs/toolkit.
A monitored slice automatically manages the lifecycle of provided data by tracking when it's stale, when it's loading, or when it's available.

## Features

1. If data is marked as stale, it's only reloaded if actively being monitored via `useMonitoredData` hook (returned during slice creation).
2. Optional input params for loader function are provided by a redux selector, and the loader will automatically be called if the result from the selector
   ever changes. This allows making your slice data dependent on other redux store
   data without having to manually manage that dependency.
3. Can configure if you want to return old data while slice is actively stale/loading or you can return something else instead (e.g. an empty array).
4. Data/actions are provided via selectors/slice actions as well as hook results,
   so you can use whatever is most convenient.

## Installation

1. `yarn add @adamldoyle/reduxjs-toolkit-monitored-slice`

## Examples

Multiple examples provided via Storybook

- https://adamldoyle-reduxjs-toolkit-monitored-slice-storybook.netlify.app/

OR

- `yarn storybook`

## Development

1. `yarn install`
2. `yarn build`

## Contributors

[Adam Doyle](https://github.com/adamldoyle)

## License

MIT
