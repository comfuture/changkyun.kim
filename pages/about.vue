<script setup lang="ts">
useHead({
  title: 'about me'
})
</script>
<template>
  <main>
    <section class="cover">
      <nuxt-img class="object-cover w-full" preset="cover" src="/image/cover.jpg" />
      <!-- <img src="/image/cover.jpg" /> -->
    </section>
    <section class="content">
      <div class="container">
        <div class="card">
          <div class="w-full flex justify-center">
            <div>
              <img alt="..." src="/image/avatar.jpg" class="avatar">
            </div>
          </div>
          <div class="bio">
            <data class="name">김창균</data>
            <i class="text-gray-500 material-symbols-outlined">place</i> Seoul, KOREA <br />
            <i class="text-gray-500 material-symbols-outlined">announcement</i> 한국어, 日本語, English, Español <br />
          </div>
          <div class="description">
            <h3>의로운 원칙주의자</h3>
            <p>원리와 원칙을 중요시 여기며 말과 행동이 악의 편에 서지 않게 하기 위해 노력합니다.</p>
            <h3>슬로우 러너</h3>
            <p>빠르게 배우지 못하지만 꾸준히 익히며 깊이있게 이해하고 적절히 사용합니다.</p>
            <h3>해결사</h3>
            <p>데이터와 경험과 직관을 이용하여 문제를 해결하는 것을 좋아하고 잘 합니다.</p>
          </div>
          <div class="description">
            <h3>관심있는 것</h3>
            <ul>
              <li>육아</li>
              <li>요리</li>
              <li>프로그래밍</li>
              <li>캠핑</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
<script lang="ts">
export default {
  name: 'about'
}
</script>
<style scoped lang="postcss">
.material-icons {
  vertical-align: middle;
}

main {
  @apply flex flex-col;

  section.cover {
    img {
      @apply object-cover w-full h-64;

      @screen lg {
        @apply h-[300px];
        height: 300px !important;
      }

      @screen xl {
        height: 400px !important;
      }
    }
  }

  section.content {
    @apply md:bg-gray-200 md:dark:bg-gray-800 flex-grow;

    .container {
      @apply mx-auto items-center flex flex-wrap md:-mt-16 md:pb-8;

      .card {
        @apply flex flex-col w-full md:w-10/12 md:mx-auto md:rounded-lg md:bg-white md:shadow-lg xl:w-8/12 dark:bg-gray-700;

        img.avatar {
          @apply block shadow-xl rounded-full align-middle border-none absolute z-0 h-32 w-32 -m-16 md:h-48 md:w-48 md:-m-24;
        }

        .bio {
          line-height: 3rem;
          @apply pt-24 px-4 text-center mb-4 border-b border-gray-300;

          data.name {
            @apply block text-xl;
          }
        }

        .description {
          @apply prose md:prose-lg dark:prose-invert py-2 px-4;

          h3 {
            @apply mt-3;
          }
        }
      }
    }
  }
}
</style>
