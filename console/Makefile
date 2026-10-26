CC = gcc
CFLAGS = -std=c11 -Wall -Wextra -Wpedantic -Wshadow -Wformat=2
SOURCES = $(wildcard src/*.c)
HEADERS = $(wildcard src/*.h)
OBJECTS = $(patsubst src/%.c,build/%.o,$(SOURCES))
TARGET = build/library

ifeq ($(OS),Windows_NT)
SHELL := cmd.exe
LDLIBS += -lwinmm
TARGET = build/library.exe
MKDIR = if not exist build mkdir build
REMOVE = del /Q
else
MKDIR = mkdir -p build
REMOVE = rm -f
endif

.PHONY: all library clean
all: $(TARGET)
library: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CC) $(CFLAGS) $(OBJECTS) -o $@ $(LDLIBS)

build:
	$(MKDIR)

build/%.o: src/%.c $(HEADERS) | build
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	$(REMOVE) $(subst /,$(if $(filter Windows_NT,$(OS)),\,/),$(TARGET) $(OBJECTS))
