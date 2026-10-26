#include "utils.h"
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void trim_newline(char *text) { text[strcspn(text, "\n")] = '\0'; }

void read_line(const char *prompt, char *buffer, size_t size) {
    printf("%s", prompt);
    if (fgets(buffer, (int)size, stdin) == NULL) { buffer[0] = '\0'; return; }
    trim_newline(buffer);
}

int read_int(const char *prompt) {
    char buffer[32]; char *end; long value;
    while (1) {
        read_line(prompt, buffer, sizeof(buffer));
        value = strtol(buffer, &end, 10);
        while (isspace((unsigned char)*end)) end++;
        if (buffer[0] != '\0' && *end == '\0') return (int)value;
        printf("请输入有效的数字。\n");
    }
}

int contains_ignore_case(const char *text, const char *keyword) {
    size_t text_length = strlen(text), keyword_length = strlen(keyword);
    if (keyword_length == 0) return 1;
    if (keyword_length > text_length) return 0;
    for (size_t i = 0; i <= text_length - keyword_length; i++) {
        size_t j = 0;
        while (j < keyword_length && tolower((unsigned char)text[i + j]) == tolower((unsigned char)keyword[j])) j++;
        if (j == keyword_length) return 1;
    }
    return 0;
}
