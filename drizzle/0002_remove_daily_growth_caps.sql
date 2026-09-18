UPDATE `activity_growth_events`
SET `applied_growth` = `raw_growth`
WHERE `applied_growth` < `raw_growth`;

UPDATE `daily_growth_ledgers`
SET `applied_growth` = `raw_growth`,
    `category_cap` = 0,
    `total_cap` = 0
WHERE `applied_growth` < `raw_growth`
   OR `category_cap` != 0
   OR `total_cap` != 0;
