#ifndef UTILS_H
#define UTILS_H
#include <stddef.h>
void read_line(const char *prompt, char *buffer, size_t size);
int read_int(const char *prompt);
int contains_ignore_case(const char *text, const char *keyword);
void trim_newline(char *text);
#endif
