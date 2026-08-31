# Table mode source notes

## Current data source coverage

The current public-player implementation uses the amae-koromo 4-player data API. The upstream frontend and public API usage expose the Gold, Jade, and Throne ranked rooms, with East and South variants.

Current supported 4-player mode IDs:

- 16: Throne (South)
- 12: Jade (South)
- 8: Gold (South)
- 15: Throne East
- 11: Jade East
- 9: Gold East

Lower ranked rooms such as Silver/Bronze are not currently exposed by this upstream dataset, so adding them to the UI alone would not produce historical player records. Supporting them requires a second data source or an independent collector.

## Korean terminology

Use these labels consistently in the UI:

- 왕좌탁
- 옥탁
- 금탁
- 왕좌탁 동풍전
- 옥탁 동풍전
- 금탁 동풍전

The South-round variants omit an extra `남풍전` suffix because `왕좌탁/옥탁/금탁` are the standard room names used throughout the service, while East variants are explicitly marked as `동풍전`.
