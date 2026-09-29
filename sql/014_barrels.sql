CREATE OR REPLACE MACRO is_barrel(launch_speed, launch_angle) AS
  launch_speed >= 98
  AND launch_angle BETWEEN greatest(8, 26 - (launch_speed - 98)) AND least(50, 30 + 1.5 * (launch_speed - 98));
