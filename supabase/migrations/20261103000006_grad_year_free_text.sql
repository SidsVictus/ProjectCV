-- Graduation year is free text (for example 2028 or '28), at most 10 characters.
alter table public.profiles drop constraint profiles_grad_year_check;
alter table public.profiles add constraint profiles_grad_year_check check (char_length(grad_year) <= 10);
