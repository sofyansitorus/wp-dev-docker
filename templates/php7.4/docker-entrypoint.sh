#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$1" == apache2* ]] || [ "$1" = 'php-fpm' ]; then
	uid="$(id -u)"
	gid="$(id -g)"
	if [ "$uid" = '0' ]; then
		case "$1" in
			apache2*)
				user="${APACHE_RUN_USER:-www-data}"
				group="${APACHE_RUN_GROUP:-www-data}"

				# strip off any '#' symbol ('#1000' is valid syntax for Apache)
				pound='#'
				user="${user#$pound}"
				group="${group#$pound}"
				;;
			*) # php-fpm
				user='www-data'
				group='www-data'
				;;
		esac
	else
		user="$uid"
		group="$gid"
	fi

	if [ ! -e index.php ] && [ ! -e wp-includes/version.php ]; then
		# if the directory exists and WordPress doesn't appear to be installed AND the permissions of it are root:root, let's chown it (likely a Docker-created directory)
		if [ "$uid" = '0' ] && [ "$(stat -c '%u:%g' .)" = '0:0' ]; then
			chown "$user:$group" .
		fi

		echo >&2 "WordPress not found in $PWD - copying now..."
		if [ -n "$(find -mindepth 1 -maxdepth 1 -not -name wp-content)" ]; then
			echo >&2 "WARNING: $PWD is not empty! (copying anyhow)"
		fi
		sourceTarArgs=(
			--create
			--file -
			--directory /usr/src/wordpress
			--owner "$user" --group "$group"
		)
		targetTarArgs=(
			--extract
			--file -
		)
		if [ "$uid" != '0' ]; then
			# avoid "tar: .: Cannot utime: Operation not permitted" and "tar: .: Cannot change mode to rwxr-xr-x: Operation not permitted"
			targetTarArgs+=( --no-overwrite-dir )
		fi
		# loop over "pluggable" content in the source, and if it already exists in the destination, skip it
		# https://github.com/docker-library/wordpress/issues/506 ("wp-content" persisted, "akismet" updated, WordPress container restarted/recreated, "akismet" downgraded)
		for contentPath in \
			/usr/src/wordpress/.htaccess \
			/usr/src/wordpress/wp-content/*/*/ \
		; do
			contentPath="${contentPath%/}"
			[ -e "$contentPath" ] || continue
			contentPath="${contentPath#/usr/src/wordpress/}" # "wp-content/plugins/akismet", etc.
			if [ -e "$PWD/$contentPath" ]; then
				echo >&2 "WARNING: '$PWD/$contentPath' exists! (not copying the WordPress version)"
				sourceTarArgs+=( --exclude "./$contentPath" )
			fi
		done
		tar "${sourceTarArgs[@]}" . | tar "${targetTarArgs[@]}"
		echo >&2 "Complete! WordPress has been successfully copied to $PWD"
	fi
fi

exec "$@"
